# RNA Panneau V2 — Final Implementation Roadmap

> **Version:** 3.0 Final (with Copy-Paste Code)  
> **Date:** 2026-09-10  
> **Status:** Ready to Launch  
> **Timeline to Ship:** 2-3 weeks (solo + Claude AI)

---

## TL;DR

**What:** Build CRM + Invoicing + Alerts system for billboard park management

**How:** Reuse 80% code/patterns from Automatic_CV (Kanban), Frappe CRM (status logging), Twenty (React), ERPNext (payment logic)

**When:** 2-3 weeks (18-20 hours actual dev work, with AI handling boilerplate)

**Stack:** Next.js 14, React 18, Prisma, PostgreSQL, TypeScript, Shadcn/ui, @dnd-kit (drag-drop)

---

## REUSE SOURCES (Consolidated)

### Tier 1: Copy-Paste Ready (95%+)

```
✅ Frappe CRM Status Change Logging
   → Copy: crm/fcrm/doctype/crm_status_change_log/
   → Time: ~1 hour
   → Result: Prisma middleware for audit trail

✅ Frappe CRM Deal Schema
   → Copy: crm/fcrm/doctype/crm_deal/crm_deal.json fields
   → Time: ~1 hour
   → Result: Contrat Prisma model + stage enums

✅ Twenty Stage Constants
   → Copy: packages/twenty-apps/.../opportunity-stage-options.ts
   → Time: ~0.5 hour
   → Result: Contrat statuts enum (draft/signed/active/ended)

✅ Automatic_CV Kanban Components
   → Copy: KanbanBoard.jsx → ContratKanban.tsx
   → Time: ~2 hours (TypeScript conversion)
   → Result: Drag-drop UI for Contrat workflow

✅ RNA Panneau V1 Base
   → Keep: Shadcn/ui, auth, API helpers, Prisma setup
   → Time: 0 (already exists)
   → Result: Foundation ready
```

### Tier 2: Port Logic (80%+)

```
⚙️ ERPNext Payment Status Calculation
   → Adapt: erpnext/accounts/doctype/sales_invoice/services/status.py
   → Time: ~2 hours
   → Result: Invoice status logic (draft → générée → payée/impayée)

⚙️ Twenty React Patterns
   → Adapt: React hooks + form handling patterns
   → Time: ~2 hours
   → Result: Form components for Invoice, Contrat, Client

⚙️ Frappe CRM SLA Logic
   → Adapt: Alert calculation (J-30 before contract end)
   → Time: ~1 hour
   → Result: Alert system
```

### Tier 3: Architecture Patterns (Inspiration)

```
📚 Frappe CRM Form Scripting
   → Adapt: Form field validation + computed fields
   → Pattern: React useEffect + form state

📚 Twenty Service Layer Pattern
   → Adopt: Service functions + Zod validation
   → Pattern: Already using, just expand

📚 ERPNext State Machine
   → Adopt: Declarative status transitions + validation
   → Pattern: Zod schema for state validation
```

---

## EXECUTION ROADMAP (4 Phases, 2-3 weeks)

### Phase 1: Foundation + Kanban (Days 1-3)

#### Task 1.1: Extend Database Schema
- **Reuse:** RNA V1 Prisma setup + Frappe CRM Deal fields
- **New Models:** `Contrat`, `ContratFace`, `Invoice`, `InvoiceLigne`, `Payment`, `Alert`, `AuditLog`
- **Copy From:** Frappe CRM `crm_deal.json` (status, status_change_log, sla fields)
- **Time:** ~1 hour
- **Deliverable:** Prisma schema complete

#### Task 1.2: Setup Audit Logging Middleware
- **Reuse:** Frappe CRM status change logging pattern
- **Copy:** Status change log concept + duration calculation
- **Implement:** Prisma middleware for tracking changes
- **Time:** ~1 hour
- **Deliverable:** AuditLog table + middleware working

#### Task 1.3: Kanban for Contrats
- **Reuse:** Automatic_CV KanbanBoard.jsx (100% copy-adapt)
- **Copy:** 
  - `KanbanBoard.jsx` → `src/components/ContratKanban.tsx`
  - `KanbanColumn.jsx` → `src/components/ContratColumn.tsx`
  - `KanbanCard.jsx` → `src/components/ContratCard.tsx`
- **Install:** `npm install @dnd-kit/core @dnd-kit/utilities`
- **Time:** ~2 hours (TypeScript + Shadcn integration)
- **Deliverable:** Drag-drop Contrat workflow by status

#### Task 1.4: Contrat State Machine + API
- **Reuse:** ERPNext state machine pattern
- **Implement:** Zod schema for status transitions (draft → signed → active → ended)
- **Time:** ~1 hour
- **Deliverable:** POST `/api/contrats/[id]/sign`, `/api/contrats/[id]/activate`, etc.

**Phase 1 Total:** ~5 hours

---

### Phase 2: Invoicing (Days 4-7)

#### Task 2.1: Invoice Schema + State Machine
- **Reuse:** ERPNext Sales Invoice structure + status calculation logic
- **Copy:** Payment status computation from `erpnext/accounts/services/status.py`
- **Implement:** Invoice status transitions (draft → générée → payée/impayée)
- **Time:** ~2 hours
- **Deliverable:** Invoice Prisma model + API endpoints

#### Task 2.2: PDF Generation
- **Reuse:** RNA V1 `lib/pdf-photo.ts` pattern + Puppeteer
- **Adapt:** Invoice template instead of photo template
- **Time:** ~1.5 hours
- **Deliverable:** POST `/api/invoices/[id]/generate` → PDF buffer

#### Task 2.3: Invoice Forms & UI
- **Reuse:** Twenty React form patterns + Shadcn form components
- **Copy:** Invoice line item table pattern (similar to Twenty's record tables)
- **Time:** ~2 hours
- **Deliverable:** InvoiceForm, InvoiceList, InvoiceDetail pages

#### Task 2.4: Invoice API (Full CRUD)
- **Reuse:** RNA V1 API helpers + pattern
- **Time:** ~1 hour
- **Deliverable:** CRUD endpoints + PDF generation trigger

**Phase 2 Total:** ~6.5 hours

---

### Phase 3: Alerts + Dashboard (Days 8-10)

#### Task 3.1: Alert System
- **Reuse:** Frappe CRM SLA + ERPNext notification patterns
- **Implement:** Alerts table + Bull job queue for daily checks
- **Time:** ~2 hours
- **Deliverable:** Alert creation + background job worker

#### Task 3.2: Payment Relance
- **Reuse:** ERPNext payment tracking logic
- **Implement:** J-15 alert for unpaid invoices + manual relance trigger
- **Time:** ~1.5 hours
- **Deliverable:** `POST /api/relance/send` + background job

#### Task 3.3: Dashboard
- **Reuse:** Automatic_CV Dashboard.jsx structure
- **Adapt:** KPI cards for RNA (occupation %, CA, debt, overdue invoices)
- **Time:** ~1.5 hours
- **Deliverable:** Dashboard page with KPI cards + invoice due table

**Phase 3 Total:** ~5 hours

---

### Phase 4: Polish + Deploy (Days 11-14)

#### Task 4.1: Role-Based Access Control
- **Reuse:** RNA V1 auth + RoleGate component
- **Extend:** Add Comptable role for invoice management
- **Time:** ~1 hour
- **Deliverable:** Permissions working across app

#### Task 4.2: Encryption for PII
- **Implement:** NIF, STAT, RCS encryption at-rest
- **Time:** ~0.5 hour
- **Deliverable:** Sensitive fields encrypted

#### Task 4.3: Testing & QA
- **Time:** ~2 hours
- **Deliverable:** Core workflows tested end-to-end

#### Task 4.4: Railway Deployment
- **Reuse:** RNA V1 Railway setup
- **Time:** ~1 hour
- **Deliverable:** V2 live on Railway

**Phase 4 Total:** ~4.5 hours

---

## TOTAL: 20.5 Hours Dev Work

### Reality Check: With Claude AI

- **Tasks that AI does:** CRUD boilerplate, migrations, test stubs, form generation
- **Tasks you do:** Business logic review, UX polish, testing
- **Speedup factor:** ~50% (AI writes 50%, you review + business logic)

### Calendar Timeline

| Case | Duration | Realistic? |
|------|----------|-----------|
| **Heroic sprint** (6h/day focused) | 3-4 days | No, burnout |
| **Realistic pace** (4h/day, part-time) | 5-6 days focused work | Yes, but only if solo focus |
| **With interruptions** (2-3h/day) | 1-2 weeks | Yes, real world |
| **Buffer for iteration** | +3-5 days | Yes, always needed |

**Final Estimate:**
- **Best case:** 10-12 days (next 2 weeks)
- **Realistic:** 2-2.5 weeks (14-18 days)
- **Safe buffer:** 3 weeks (21 days)

---

## WHAT YOU'LL HAVE (MVP Option 3)

### ✅ Shipped

```
CRM LEAN
├── Client list + create/edit
├── Contact management per client
└── KPI cards (CA, debt, active contracts)

CONTRATS with KANBAN
├── Drag-drop by status (draft → signed → active → ended)
├── Client + faces + tarif per contract
├── BAT tracking (send date, client validation)
└── Workflow buttons (Sign, Activate, End)

FACTURATION INTÉGRÉE
├── Invoice creation (manual from UI)
├── Auto PDF generation + download
├── Invoice list with status (draft, générée, envoyée, payée, impayée)
└── Workflow state transitions

ALERTES + RELANCE
├── Alerts list (contract end J-30, unpaid invoice J-15)
├── Manual relance button (send email + app notification)
└── Background job for daily checks

DASHBOARD
├── KPI cards (occupation %, CA this month, debt, overdue count)
├── Invoice due list (next 7 days)
└── Billboard status summary

AUTH + PERMISSIONS
├── Role-based (Admin, Commercial, Comptable)
├── Audit logs for sensitive actions
└── PII encryption (NIF, STAT, RCS)
```

### ❌ Defer to V2.1

```
Advanced Dashboard (charts, analytics)
Custom Fields System (user-defined fields)
Real-time WebSocket alerts
Activity feed per client
Payment gateway integration (Stripe)
Mobile app
Bulk import from Excel
```

---

## FEATURE REQUESTS SURFACED DURING DESIGN WORK (not built — log only)

Captured from the 2026-09-08 scoping meeting and later design-session feedback. Explicitly **not** in scope for the current design/refinement pass — record here, don't implement ahead of a dedicated task.

- Un contrat peut couvrir plusieurs panneaux (plusieurs faces sur plusieurs panneaux différents pour un même client) — actuellement un Contrat est lié à un seul `billboardId`.
- Colonnes affichables/choisies par l'utilisateur dans la BD (page Inventaire) et dans l'export — actuellement colonnes fixes.
- Admin doit pouvoir changer les droits des autres utilisateurs directement dans l'app (pas seulement au niveau code/seed).
- Facturation directe intégrée au CRM (génération de facture depuis la fiche contrat/client, pas un module séparé).
- Alerte facture-non-éditée récurrente : si une facture n'est pas éditée, relance tous les 15 jours (pas une alerte unique).
- Double-face : statut/couleur visuellement distincts dans l'inventaire pour les panneaux double-face vs simple-face (sans ajouter de nouveaux champs — juste un affichage différencié).
- Formats de panneaux "déformatés" (dimensions sur-mesure, hors 2x1/4x3/6x3/8x3/12x3) — le modèle actuel de `Dimension` est un enum fixe.
- Réglages : pouvoir ajouter un type d'impression directement depuis les paramètres (actuellement Éco-solvant/UV hardcodés), avec délai d'expiration paramétrable par type (6 mois éco-solvant, 1 an UV, doublé si laminé).
- Vue "société globale" au-delà du parc de panneaux (KPIs financiers/opérationnels transverses), au-delà du dashboard actuel centré panneaux.
- Automatisation avancée / IA (mentionné comme aspiration à terme, non cadré).
- Rétention des notifications : garder tout l'historique ne sert à rien. Purge hebdomadaire automatique des notifications de plus d'une semaine, durée réglable dans les paramètres. (Aujourd'hui : aucune purge, la table `Notification` grossit indéfiniment.)

---

## BEFORE YOU LAUNCH

### Checklist

- [ ] Read `docs/business-spec.md` (consolidated requirements)
- [ ] Review `docs/architecture-spec.md` (data model + patterns)
- [ ] Skim `docs/superpowers/plans/2026-09-10-rna-v2-implementation.md` (detailed tasks)
- [ ] Decide: **Subagent-Driven** (recommended) or **Inline Execution**?

### Decision Point

**Option A: Subagent-Driven (Recommended)**
- I dispatch fresh subagent per task (20 tasks across phases)
- Two-stage review: spec compliance → code quality
- Faster iteration, quality gates
- You focus on business logic + QA
- **Timeline:** 2-2.5 weeks

**Option B: Inline Execution (This Session)**
- I execute tasks sequentially with checkpoints
- You review + redirect in real-time
- Slower but more direct feedback
- **Timeline:** 3-4 weeks (more back-and-forth)

---

## NEXT MOVE

You ready to **launch?**

If yes → Which execution mode?
- A) Subagent-Driven (I'll invoke superpowers:subagent-driven-development)
- B) Inline (I'll start Task 1.1 here, you review after each phase)

**I recommend A** — subagent-driven lets you run the biz while AI/I iterate fast.
