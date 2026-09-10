# RNA Panneau V2 — Architecture Specification

> **Inspiré par** : ERPNext patterns (Contract, Sales Invoice, Payment Entry, custom fields, workflow state machine)  
> **Stack** : Next.js, React, Node.js, Prisma, PostgreSQL, Railway  
> **Approche** : Réutiliser patterns validés, implémenter 100% custom en Node/React

---

## 1. Architecture Générale

```
┌─────────────────────────────────────────────────────────────┐
│                     RNA Panneau V2 (Next.js)                 │
├─────────────────────┬──────────────────┬────────────────────┤
│   Frontend (React)  │  Next.js API     │  Database (PG)     │
│  - CRM Client       │  - REST + gRPC   │  - Prisma ORM      │
│  - Contrats/BC      │  - Webhook       │  - Migrations      │
│  - Facturation      │  - Background    │                    │
│  - Alertes/Kanban   │    jobs (Bull)   │                    │
└─────────────────────┴──────────────────┴────────────────────┘
```

---

## 2. Data Model (inspiré ERPNext)

### Core Entities

#### `Client` (Customer)
```prisma
model Client {
  id String @id @default(cuid())
  name String
  nif String @encrypted  // N°NIF chiffré
  stat String? @encrypted
  rcs String? @encrypted
  carteF String? @encrypted  // Carte Fiscale
  
  contacts Contact[]
  contrats Contrat[]
  factures Invoice[]
  
  // KPIs
  caTotalMTD Float @default(0)
  detteMTD Float @default(0)
  facturesImpayees Int @default(0)
  firstContractDate DateTime?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Contact {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)
  
  name String
  role String  // "commercial", "facturation", etc.
  email String
  phone String?
  
  createdAt DateTime @default(now())
}
```

#### `Contrat` vs `BonCommande` (même table, différencié par type)
```prisma
model Contrat {
  id String @id @default(cuid())
  numero String @unique
  type String  // "contrat" | "bc" (distinction métier)
  
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  
  faces ContratFace[]
  
  // Dates & Reconduction
  dateDebut DateTime
  dateFin DateTime
  typeReconduction String  // "tacite" | "express" | "negocie"
  statut String  // "draft" | "signed" | "active" | "ended" | "cancelled"
  
  // Document
  pdfUrl String?  // Contrat signé PDF
  
  // Tracking BAT
  dateBAT DateTime?  // Date envoi bon à tirer
  batValidated Boolean @default(false)  // Client a validé
  batValidatedDate DateTime?
  
  // Workflow state machine
  submittedAt DateTime?
  submittedBy String?  // userId
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ContratFace {
  id String @id @default(cuid())
  contratId String
  contrat Contrat @relation(fields: [contratId], references: [id], onDelete: Cascade)
  
  faceId String
  face Billboard @relation(fields: [faceId], references: [id])
  
  tarifMensuel Float?
  tarifSemestriel Float?
  tarifAnnuel Float?
  
  // Impression tracking
  dateImpressionDebut DateTime?
  dateImpressionFin DateTime?
  typeImpression String  // "eco-solvant", "UV", "laminee"
  
  jourAlerte Int @default(7)  // J-7 avant expiration
  
  createdAt DateTime @default(now())
}
```

#### `Invoice` (Facture) — inspiré ERPNext Sales Invoice
```prisma
model Invoice {
  id String @id @default(cuid())
  numero String @unique
  
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  
  lignes InvoiceLigne[]
  
  // Génération
  genereeAt DateTime?  // "Éditer" = générer + PDF
  genereeBy String?  // userId
  pdfUrl String?
  
  // Paiement tracking
  montantTotal Float
  montantTaxe Float  // TVA 20%
  montantNet Float
  
  dateEchance DateTime
  statut String  // "draft" | "generee" | "envoyee" | "payee" | "impayee"
  
  // Relance
  dernierRelanceDate DateTime?
  relanceCount Int @default(0)
  alerteImpayee Boolean @default(false)  // J-15 si impayée
  
  // État workflow
  submittedAt DateTime?
  submittedBy String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model InvoiceLigne {
  id String @id @default(cuid())
  invoiceId String
  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  
  description String  // "Location face DIA-0001-A, nov 2026"
  faceId String?
  montantHT Float
  tauxTaxe Float @default(0.20)  // TVA 20%
  montantTTC Float
}

model Payment {
  id String @id @default(cuid())
  invoiceId String?
  // Note: Payment Entry tracking (like ERPNext)
  
  montant Float
  dateReception DateTime
  modePayement String  // "virement", "cheque", "especes"
  
  createdAt DateTime @default(now())
}
```

#### `Billboard` (Panneau)
```prisma
model Billboard {
  id String @id @default(cuid())
  diaNumber String @unique  // DIA-0001-A
  
  // Localisation
  lieu String
  gpsLat Float?
  gpsLng Float?
  
  // Physique
  format String  // "2x1", "4x3", "6x3", "8x3", "12x3"
  type String  // "recto-verso", "v-shape", "unique"
  
  // État
  statut String  // "loue" | "libre" | "maintenance" | "a-reparer"
  
  faces BillboardFace[]
  contrats ContratFace[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BillboardFace {
  id String @id @default(cuid())
  billboardId String
  billboard Billboard @relation(fields: [billboardId], references: [id], onDelete: Cascade)
  
  nom String  // "A", "B", "Recto", "Verso"
  orientation String?  // "Nord", "Sud", etc.
}
```

#### `Alert` (Alertes) — système centralisé
```prisma
model Alert {
  id String @id @default(cuid())
  type String  // "fin-contrat" | "impression-expiration" | "paiement-impaye" | "facture-non-generee"
  
  relatedId String  // contratId, faceId, invoiceId
  relatedType String  // "contrat", "face", "invoice"
  
  clientId String?
  client Client? @relation(fields: [clientId], references: [id])
  
  statut String  // "pending" | "sent" | "acknowledged" | "resolved"
  
  dateAlert DateTime  // Quand l'alerte s'active
  dateEnvoi DateTime?
  dateLecture DateTime?
  
  // Destination
  envoiEmail Boolean @default(true)
  envoiApp Boolean @default(true)
  envoiClient Boolean @default(false)  // Envoyer alerte au client directement ?
  
  createdAt DateTime @default(now())
}
```

#### `AuditLog` (Logs audit) — pour permissions/sensible
```prisma
model AuditLog {
  id String @id @default(cuid())
  userId String
  action String  // "create", "update", "delete", "generate-invoice", "send-relance"
  
  entityType String  // "Invoice", "Contrat", "Client"
  entityId String
  
  oldValues Json?
  newValues Json?
  
  createdAt DateTime @default(now())
}
```

---

## 3. Workflows (State Machines)

### Contrat Workflow (inspiré ERPNext)
```
draft → signed → active → ended / cancelled
         ↓
    (PDF upload)
```

### Invoice Workflow
```
draft → generee (PDF créé) → envoyee → payee / impayee
```

### Payment Tracking
- Invoice → Payment Entry (tracking manual)
- Alerte J-15 si `statut=impayee`
- Relance possible (email + app)

### BAT Workflow (Bon à Tirer)
```
Contrat signed → BAT sent (email client) → BAT validated (client répond)
                  ↓
             dateBAT = now()
             batValidated = true (manual ou webhook si possible)
```

---

## 4. Modules by Block

### Block A: Panneaux & Impressions
- CRUD Billboard + BillboardFace
- Statut tracking (libre, loué, maintenance)
- Impression types, dates, alerte expiration
- GPS location optional

### Block B: CRM Client + Contrats/BC
- Client fiche (données légales chiffrées)
- Contact multiples
- Contrat vs BC (même table, type différencié)
- PDF upload contrat signé
- BAT tracking (dateBAT, batValidated)
- Reconduction workflow

### Block C: Facturation
- Invoice génération (manual via UI)
- PDF export (Ready to send to client)
- Invoice ligne (description, montant, TVA 20%)
- Workflow state machine (draft → generee → envoyee → payee/impayee)
- Numéro auto-incrémenté

### Block D: Relance Paiement & Alertes
- Alert system centralisé (type, status, destination)
- Alerte J-15 si facture impayée
- Alerte J-30 avant fin contrat
- Alerte J-X avant expiration impression
- Email + in-app notifications
- Logs audit pour actions sensibles

### Block E: CRM Lean + Dashboard
- KPIs client (CA, dette, factures impayées)
- Historique activité client (optionnel journal)
- Dashboard : taux occupation, factures à échéance, carte geo
- Reporting : CA mensuel, impayés, etc.

### Block F: Permissions & Security
- Roles : Admin, Commercial, Technicien, Comptable
- Custom permissions (qui voit/edit quoi)
- Audit logs pour delete, edit facture, relance
- Chiffrement : NIF, STAT, RCS, Carte Fiscale

---

## 5. Technical Patterns from ERPNext

### Custom Fields
- Mechanism to add fields dynamically (like ERPNext `custom_fields`)
- UI form generator adapts to new fields

### Hooks/Automation
- `before_save` validations
- `after_save` side effects (create audit log, send email, trigger alert)
- `before_submit` approval logic

### Workflow State Machine
- Document statuses (draft, signed, active, ended)
- Transitions validation (can only go to certain states)
- Logs who transitioned when

### Document Versioning
- Track changes (oldValues → newValues)
- Audit trail for compliance

### Notifications
- Email templates (like ERPNext email digest)
- In-app notifications
- Webhook for external integration

---

## 6. External Integrations (Future)

- **Emailing** : Resend / SendGrid
- **PDF Generation** : Puppeteer / Graphql-pdf
- **Payments** : Stripe (optional, payment tracking only)
- **Webhooks** : For BAT validation (if client can respond via webhook)

---

## 7. Dev Setup

- **Framework** : Next.js 14+ (App Router)
- **Backend** : Next.js API routes + Middleware
- **ORM** : Prisma 5+
- **DB** : PostgreSQL (Railway native)
- **Auth** : NextAuth.js (simple JWT for now)
- **Jobs** : Bull queue (Redis for Railway)
- **Styling** : TailwindCSS (existing)
- **Forms** : React Hook Form
- **State** : Zustand
- **PDF** : Puppeteer or similar

---

## 8. Guiding Principles

1. **Copy ERPNext patterns, not code** — use their proven state machines, custom field system, workflow concepts
2. **One entity, multiple faces via type field** — Contrat + BC in same table, differentiated by `type` field
3. **Audit everything sensitive** — Invoice generation, payment relance, client data access
4. **Alerts as first-class entity** — centralized, not scattered
5. **Workflow state machine** — every document has explicit states, transitions logged
6. **Encryption for PII** — NIF, STAT, RCS at-rest encrypted

---

## 9. MVP Scope (2-3 months)

**Include** :
- Blocks A, B, C, D (90% of value)
- Basic permissions (admin vs commercial vs comptable)
- Email alerts + in-app
- Audit logs for sensitive actions
- PDF invoice generation

**Defer** :
- Block E (dashboard/reporting) — nice-to-have
- Advanced analytics
- Mobile app
- Payment gateway integration (Stripe)
- Webhook BAT validation (manual for now)

