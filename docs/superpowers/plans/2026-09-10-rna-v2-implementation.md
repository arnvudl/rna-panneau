# RNA Panneau V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete CRM + integrated billing + payment tracking system for billboard advertising park management, reusing proven ERPNext patterns adapted to Next.js/Node stack.

**Architecture:** ERPNext-inspired data models (Contract state machine, Sales Invoice workflow, custom fields) implemented in Next.js/Node with Prisma ORM and PostgreSQL. Five coherent blocks: Billboards, CRM+Contracts, Invoicing, Alerts+Payment Relance, Dashboard. Each block is a self-contained MVP deliverable.

**Tech Stack:** Next.js 14 (API routes + App Router), React 18, Prisma 5, PostgreSQL, TailwindCSS, Bull (job queue), Puppeteer (PDF), NextAuth.js (auth).

---

## File Structure Overview

```
src/
├── app/
│   ├── api/
│   │   ├── billboards/
│   │   ├── clients/
│   │   ├── contrats/
│   │   ├── invoices/
│   │   ├── alerts/
│   │   └── auth/
│   ├── (dashboard)/
│   │   ├── billboards/
│   │   ├── clients/
│   │   ├── contrats/
│   │   ├── invoices/
│   │   └── alerts/
│   └── layout.tsx
├── lib/
│   ├── auth.ts
│   ├── db.ts (Prisma client)
│   ├── workflow.ts (state machine logic)
│   ├── encryption.ts (NIF/STAT/RCS)
│   ├── pdf.ts (invoice PDF generation)
│   └── validators.ts
├── components/
│   ├── billboards/
│   ├── clients/
│   ├── contrats/
│   ├── invoices/
│   ├── alerts/
│   └── common/
├── services/
│   ├── billboardService.ts
│   ├── clientService.ts
│   ├── contratService.ts
│   ├── invoiceService.ts
│   ├── alertService.ts
│   └── auditService.ts
├── jobs/
│   ├── alertWorker.ts (Bull queue)
│   ├── invoiceReminder.ts
│   └── paymentRelance.ts
└── prisma/
    ├── schema.prisma
    └── migrations/
```

---

## BLOCK A: Billboards & Impressions

### Task A1: Database Schema — Billboards & Faces

**Files:**
- Create: `prisma/schema.prisma` (new Prisma schema)
- Create: `prisma/migrations/001_init_billboards.sql`

- [ ] **Step 1: Write Prisma schema for Billboard entities**

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Billboard {
  id        String   @id @default(cuid())
  diaNumber String   @unique
  
  // Location
  lieu      String
  gpsLat    Float?
  gpsLng    Float?
  
  // Physical
  format    String   // "2x1", "4x3", "6x3", "8x3", "12x3"
  type      String   // "recto-verso", "v-shape", "unique"
  
  // Status
  statut    String   @default("libre")  // "libre", "loue", "maintenance", "a-reparer"
  
  // Relations
  faces     BillboardFace[]
  contrats  ContratFace[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BillboardFace {
  id          String   @id @default(cuid())
  billboardId String
  billboard   Billboard @relation(fields: [billboardId], references: [id], onDelete: Cascade)
  
  nom         String   // "A", "B", "Recto", "Verso"
  orientation String?  // "Nord", "Sud", etc.
  
  createdAt   DateTime @default(now())
  
  @@unique([billboardId, nom])
}
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd src/
npx prisma migrate dev --name init_billboards
```

Expected: Migration succeeds, `prisma/migrations/001_init_billboards/` created.

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `node_modules/.prisma/client/` generated.

- [ ] **Step 4: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: billboard schema with Prisma migrations"
```

---

### Task A2: API Endpoints — Billboards CRUD

**Files:**
- Create: `src/app/api/billboards/route.ts` (List, Create)
- Create: `src/app/api/billboards/[id]/route.ts` (Get, Update, Delete)
- Create: `src/lib/services/billboardService.ts`
- Create: `src/__tests__/api/billboards.test.ts`

- [ ] **Step 1: Write BillboardService**

```typescript
// src/lib/services/billboardService.ts

import { prisma } from '@/lib/db'

export class BillboardService {
  async listBillboards(filters?: { statut?: string }) {
    return prisma.billboard.findMany({
      where: filters?.statut ? { statut: filters.statut } : {},
      include: { faces: true }
    })
  }

  async getBillboard(id: string) {
    return prisma.billboard.findUnique({
      where: { id },
      include: { faces: true, contrats: { include: { contrat: true } } }
    })
  }

  async createBillboard(data: {
    diaNumber: string
    lieu: string
    format: string
    type: string
    gpsLat?: number
    gpsLng?: number
  }) {
    return prisma.billboard.create({ data })
  }

  async updateBillboard(id: string, data: Partial<typeof data>) {
    return prisma.billboard.update({
      where: { id },
      data
    })
  }

  async deleteBillboard(id: string) {
    return prisma.billboard.delete({ where: { id } })
  }
}

export const billboardService = new BillboardService()
```

- [ ] **Step 2: Write API endpoints**

```typescript
// src/app/api/billboards/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { billboardService } from '@/lib/services/billboardService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const statut = searchParams.get('statut') || undefined
    const billboards = await billboardService.listBillboards({ statut })
    return NextResponse.json(billboards)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list billboards' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const billboard = await billboardService.createBillboard(body)
    return NextResponse.json(billboard, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create billboard' }, { status: 400 })
  }
}

// src/app/api/billboards/[id]/route.ts

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const billboard = await billboardService.getBillboard(params.id)
    if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(billboard)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch billboard' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const billboard = await billboardService.updateBillboard(params.id, body)
    return NextResponse.json(billboard)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update billboard' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await billboardService.deleteBillboard(params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete billboard' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Write tests**

```typescript
// src/__tests__/api/billboards.test.ts

import { billboardService } from '@/lib/services/billboardService'
import { prisma } from '@/lib/db'

describe('BillboardService', () => {
  beforeEach(async () => {
    await prisma.billboard.deleteMany({})
  })

  it('creates a billboard', async () => {
    const bb = await billboardService.createBillboard({
      diaNumber: 'DIA-0001-A',
      lieu: 'RN7 Nord',
      format: '4x3',
      type: 'recto-verso'
    })
    expect(bb.diaNumber).toBe('DIA-0001-A')
    expect(bb.statut).toBe('libre')
  })

  it('lists billboards', async () => {
    await billboardService.createBillboard({
      diaNumber: 'DIA-0001-A',
      lieu: 'RN7 Nord',
      format: '4x3',
      type: 'recto-verso'
    })
    const billboards = await billboardService.listBillboards()
    expect(billboards.length).toBe(1)
  })

  it('updates billboard status', async () => {
    const bb = await billboardService.createBillboard({
      diaNumber: 'DIA-0001-A',
      lieu: 'RN7 Nord',
      format: '4x3',
      type: 'recto-verso'
    })
    const updated = await billboardService.updateBillboard(bb.id, { statut: 'maintenance' })
    expect(updated.statut).toBe('maintenance')
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- billboards.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billboards/ src/lib/services/billboardService.ts src/__tests__/
git commit -m "feat: billboard CRUD API endpoints"
```

---

### Task A3: Frontend — Billboards UI (List, Create, Edit)

**Files:**
- Create: `src/app/(dashboard)/billboards/page.tsx`
- Create: `src/app/(dashboard)/billboards/[id]/page.tsx`
- Create: `src/components/billboards/BillboardForm.tsx`
- Create: `src/components/billboards/BillboardList.tsx`

- [ ] **Step 1: Write BillboardList component**

```typescript
// src/components/billboards/BillboardList.tsx

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function BillboardList() {
  const [billboards, setBillboards] = useState([])
  const [loading, setLoading] = useState(true)
  const [statut, setStatut] = useState('')

  useEffect(() => {
    const fetch = async () => {
      const url = statut ? `/api/billboards?statut=${statut}` : '/api/billboards'
      const res = await fetch(url)
      setBillboards(await res.json())
      setLoading(false)
    }
    fetch()
  }, [statut])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Panneaux</h1>
        <Link href="/billboards/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          + Nouveau Panneau
        </Link>
      </div>

      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">Filtrer par statut</label>
        <select 
          value={statut} 
          onChange={(e) => setStatut(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Tous</option>
          <option value="libre">Libre</option>
          <option value="loue">Loué</option>
          <option value="maintenance">Maintenance</option>
          <option value="a-reparer">À réparer</option>
        </select>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">DIA</th>
              <th className="border p-2">Lieu</th>
              <th className="border p-2">Format</th>
              <th className="border p-2">Statut</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {billboards.map((bb) => (
              <tr key={bb.id}>
                <td className="border p-2">{bb.diaNumber}</td>
                <td className="border p-2">{bb.lieu}</td>
                <td className="border p-2">{bb.format}</td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    bb.statut === 'libre' ? 'bg-green-100 text-green-800' :
                    bb.statut === 'loue' ? 'bg-blue-100 text-blue-800' :
                    bb.statut === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {bb.statut}
                  </span>
                </td>
                <td className="border p-2">
                  <Link href={`/billboards/${bb.id}`} className="text-blue-600 hover:underline">
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write BillboardForm component**

```typescript
// src/components/billboards/BillboardForm.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BillboardForm({ billboard = null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(billboard || {
    diaNumber: '',
    lieu: '',
    format: '4x3',
    type: 'recto-verso',
    gpsLat: '',
    gpsLng: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const method = billboard?.id ? 'PATCH' : 'POST'
    const url = billboard?.id ? `/api/billboards/${billboard.id}` : '/api/billboards'
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        router.push('/billboards')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <div className="mb-4">
        <label className="block mb-2 font-medium">DIA Number</label>
        <input 
          type="text" 
          value={form.diaNumber} 
          onChange={(e) => setForm({ ...form, diaNumber: e.target.value })}
          className="w-full border rounded px-3 py-2"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Lieu</label>
        <input 
          type="text" 
          value={form.lieu} 
          onChange={(e) => setForm({ ...form, lieu: e.target.value })}
          className="w-full border rounded px-3 py-2"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-2 font-medium">Format</label>
          <select 
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option>2x1</option>
            <option>4x3</option>
            <option>6x3</option>
            <option>8x3</option>
            <option>12x3</option>
          </select>
        </div>
        <div>
          <label className="block mb-2 font-medium">Type</label>
          <select 
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="recto-verso">Recto-verso</option>
            <option value="v-shape">V-shape</option>
            <option value="unique">Face unique</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-medium">GPS Lat (optionnel)</label>
          <input 
            type="number" 
            step="0.000001"
            value={form.gpsLat} 
            onChange={(e) => setForm({ ...form, gpsLat: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">GPS Lng (optionnel)</label>
          <input 
            type="number" 
            step="0.000001"
            value={form.gpsLng} 
            onChange={(e) => setForm({ ...form, gpsLng: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded font-medium"
      >
        {loading ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Write page components**

```typescript
// src/app/(dashboard)/billboards/page.tsx
import BillboardList from '@/components/billboards/BillboardList'

export default function BillboardsPage() {
  return <BillboardList />
}

// src/app/(dashboard)/billboards/[id]/page.tsx
import BillboardForm from '@/components/billboards/BillboardForm'

async function getBillboard(id: string) {
  const res = await fetch(`http://localhost:3000/api/billboards/${id}`, { cache: 'no-store' })
  return res.json()
}

export default async function BillboardEditPage({ params }: { params: { id: string } }) {
  const billboard = await getBillboard(params.id)
  return <BillboardForm billboard={billboard} />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/billboards/ src/components/billboards/
git commit -m "feat: billboard list and edit UI"
```

---

## BLOCK B: CRM Client + Contracts/BC

### Task B1: Database Schema — Clients, Contacts, Contracts (ERPNext state machine pattern)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/002_init_crm.sql`

- [ ] **Step 1: Add Client, Contact, Contrat schemas to Prisma**

```prisma
// Add to prisma/schema.prisma

model Client {
  id        String   @id @default(cuid())
  name      String
  
  // Legal data (encrypted)
  nif       String   @encrypted  // @db.VarChar(255) with encryption layer
  stat      String?  @encrypted
  rcs       String?  @encrypted
  carteF    String?  @encrypted
  
  // KPIs
  caTotalMTD Float @default(0)
  detteMTD   Float @default(0)
  facturesImpayees Int @default(0)
  firstContractDate DateTime?
  
  // Relations
  contacts Contact[]
  contrats Contrat[]
  invoices Invoice[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Contact {
  id        String   @id @default(cuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  
  name      String
  role      String   // "commercial", "facturation", etc.
  email     String
  phone     String?
  
  createdAt DateTime @default(now())
}

model Contrat {
  id        String   @id @default(cuid())
  numero    String   @unique
  type      String   // "contrat" | "bc"
  
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  
  faces     ContratFace[]
  
  // Dates & Reconduction
  dateDebut DateTime
  dateFin   DateTime
  typeReconduction String  // "tacite", "express", "negocie"
  
  // ERPNext-style state machine
  statut    String   @default("draft")  // draft → signed → active → ended / cancelled
  pdfUrl    String?
  
  // BAT tracking
  dateBAT   DateTime?
  batValidated Boolean @default(false)
  batValidatedDate DateTime?
  
  // Workflow metadata
  submittedAt DateTime?
  submittedBy String?  // userId
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ContratFace {
  id        String   @id @default(cuid())
  contratId String
  contrat   Contrat  @relation(fields: [contratId], references: [id], onDelete: Cascade)
  
  faceId    String
  face      BillboardFace @relation(fields: [faceId], references: [id])
  
  tarifMensuel Float?
  tarifSemestriel Float?
  tarifAnnuel Float?
  
  // Impression tracking
  dateImpressionDebut DateTime?
  dateImpressionFin   DateTime?
  typeImpression String?  // "eco-solvant", "UV", "laminee"
  jourAlerte Int @default(7)
  
  createdAt DateTime @default(now())
  
  @@unique([contratId, faceId])
}

// Add foreign key to BillboardFace
model BillboardFace {
  // ... existing fields ...
  contrats ContratFace[]
}
```

- [ ] **Step 2: Create and run migration**

```bash
npx prisma migrate dev --name init_crm_clients_contrats
```

Expected: Migration succeeds.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: CRM schema with Client, Contact, Contrat (ERPNext pattern)"
```

---

### Task B2: Workflow State Machine for Contracts (ERPNext pattern)

**Files:**
- Create: `src/lib/workflow.ts`
- Create: `src/lib/services/contratService.ts`
- Create: `src/__tests__/lib/workflow.test.ts`

- [ ] **Step 1: Write workflow state machine (inspired by ERPNext)**

```typescript
// src/lib/workflow.ts

type DocumentStatut = 'draft' | 'signed' | 'active' | 'ended' | 'cancelled'
type InvoiceStatut = 'draft' | 'generee' | 'envoyee' | 'payee' | 'impayee'

// State machine definition (ERPNext pattern)
const WORKFLOW_TRANSITIONS = {
  contrat: {
    draft: ['signed', 'cancelled'],
    signed: ['active', 'cancelled'],
    active: ['ended', 'cancelled'],
    ended: [],
    cancelled: []
  },
  invoice: {
    draft: ['generee', 'cancelled'],
    generee: ['envoyee', 'cancelled'],
    envoyee: ['payee', 'impayee'],
    payee: [],
    impayee: ['payee']  // Can pay impayee
  }
}

export class WorkflowEngine {
  canTransition(docType: 'contrat' | 'invoice', from: string, to: string): boolean {
    const transitions = WORKFLOW_TRANSITIONS[docType]
    return transitions[from]?.includes(to) ?? false
  }

  validateTransition(docType: string, from: string, to: string) {
    if (!this.canTransition(docType, from, to)) {
      throw new Error(`Cannot transition from ${from} to ${to} for ${docType}`)
    }
  }

  getValidTransitions(docType: 'contrat' | 'invoice', currentStatut: string): string[] {
    return WORKFLOW_TRANSITIONS[docType][currentStatut] || []
  }
}

export const workflowEngine = new WorkflowEngine()

// Audit log helper (track state changes)
export interface StateChangeLog {
  from: string
  to: string
  changedBy: string
  changedAt: Date
  reason?: string
}
```

- [ ] **Step 2: Write ContratService with workflow logic**

```typescript
// src/lib/services/contratService.ts

import { prisma } from '@/lib/db'
import { workflowEngine, StateChangeLog } from '@/lib/workflow'

export class ContratService {
  async createContrat(data: {
    numero: string
    type: 'contrat' | 'bc'
    clientId: string
    dateDebut: Date
    dateFin: Date
    typeReconduction: string
  }) {
    return prisma.contrat.create({
      data: {
        ...data,
        statut: 'draft'
      }
    })
  }

  async signContrat(contratId: string, pdfUrl: string, userId: string) {
    workflowEngine.validateTransition('contrat', 'draft', 'signed')
    
    return prisma.contrat.update({
      where: { id: contratId },
      data: {
        statut: 'signed',
        pdfUrl,
        submittedAt: new Date(),
        submittedBy: userId
      }
    })
  }

  async activateContrat(contratId: string, userId: string) {
    const contrat = await prisma.contrat.findUnique({ where: { id: contratId } })
    workflowEngine.validateTransition('contrat', contrat.statut, 'active')
    
    return prisma.contrat.update({
      where: { id: contratId },
      data: { statut: 'active' }
    })
  }

  async endContrat(contratId: string, userId: string) {
    const contrat = await prisma.contrat.findUnique({ where: { id: contratId } })
    workflowEngine.validateTransition('contrat', contrat.statut, 'ended')
    
    return prisma.contrat.update({
      where: { id: contratId },
      data: { statut: 'ended' }
    })
  }

  async getContrat(id: string) {
    return prisma.contrat.findUnique({
      where: { id },
      include: {
        client: true,
        faces: { include: { face: true } }
      }
    })
  }

  async listContrats(clientId?: string) {
    return prisma.contrat.findMany({
      where: clientId ? { clientId } : {},
      include: { client: true, faces: true }
    })
  }

  async addFaceToContrat(contratId: string, faceId: string, tarif: {
    mensuel?: number
    semestriel?: number
    annuel?: number
  }) {
    return prisma.contratFace.create({
      data: {
        contratId,
        faceId,
        tarifMensuel: tarif.mensuel,
        tarifSemestriel: tarif.semestriel,
        tarifAnnuel: tarif.annuel
      }
    })
  }

  async sendBAT(contratId: string, batDate: Date, userId: string) {
    return prisma.contrat.update({
      where: { id: contratId },
      data: {
        dateBAT: batDate,
        submittedBy: userId
      }
    })
  }

  async validateBAT(contratId: string, userId: string) {
    return prisma.contrat.update({
      where: { id: contratId },
      data: {
        batValidated: true,
        batValidatedDate: new Date()
      }
    })
  }
}

export const contratService = new ContratService()
```

- [ ] **Step 3: Write workflow tests**

```typescript
// src/__tests__/lib/workflow.test.ts

import { workflowEngine } from '@/lib/workflow'

describe('WorkflowEngine', () => {
  it('allows draft → signed for contrat', () => {
    expect(workflowEngine.canTransition('contrat', 'draft', 'signed')).toBe(true)
  })

  it('prevents draft → ended for contrat', () => {
    expect(workflowEngine.canTransition('contrat', 'draft', 'ended')).toBe(false)
  })

  it('returns valid transitions', () => {
    const transitions = workflowEngine.getValidTransitions('contrat', 'signed')
    expect(transitions).toContain('active')
    expect(transitions).toContain('cancelled')
  })

  it('throws on invalid transition', () => {
    expect(() => {
      workflowEngine.validateTransition('contrat', 'ended', 'active')
    }).toThrow()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- workflow.test.ts
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflow.ts src/lib/services/contratService.ts src/__tests__/lib/workflow.test.ts
git commit -m "feat: workflow state machine (ERPNext pattern) for Contrat"
```

---

### Task B3: API Endpoints — Clients & Contacts CRUD

**Files:**
- Create: `src/app/api/clients/route.ts`
- Create: `src/app/api/clients/[id]/route.ts`
- Create: `src/lib/services/clientService.ts`

- [ ] **Step 1: Write ClientService**

```typescript
// src/lib/services/clientService.ts

import { prisma } from '@/lib/db'
import { encryptField, decryptField } from '@/lib/encryption'

export class ClientService {
  async createClient(data: {
    name: string
    nif: string
    stat?: string
    rcs?: string
    carteF?: string
  }) {
    return prisma.client.create({
      data: {
        name: data.name,
        nif: encryptField(data.nif),
        stat: data.stat ? encryptField(data.stat) : null,
        rcs: data.rcs ? encryptField(data.rcs) : null,
        carteF: data.carteF ? encryptField(data.carteF) : null
      }
    })
  }

  async getClient(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: { contacts: true, contrats: true }
    })
    if (!client) return null
    
    // Decrypt sensitive fields before returning
    return {
      ...client,
      nif: decryptField(client.nif),
      stat: client.stat ? decryptField(client.stat) : null,
      rcs: client.rcs ? decryptField(client.rcs) : null,
      carteF: client.carteF ? decryptField(client.carteF) : null
    }
  }

  async listClients() {
    return prisma.client.findMany({
      include: { contacts: true }
    })
  }

  async updateClient(id: string, data: Partial<typeof data>) {
    const updateData: any = { ...data }
    if (data.nif) updateData.nif = encryptField(data.nif)
    if (data.stat) updateData.stat = encryptField(data.stat)
    if (data.rcs) updateData.rcs = encryptField(data.rcs)
    if (data.carteF) updateData.carteF = encryptField(data.carteF)
    
    return prisma.client.update({ where: { id }, data: updateData })
  }

  async addContact(clientId: string, contact: {
    name: string
    role: string
    email: string
    phone?: string
  }) {
    return prisma.contact.create({
      data: { ...contact, clientId }
    })
  }

  async deleteClient(id: string) {
    return prisma.client.delete({ where: { id } })
  }
}

export const clientService = new ClientService()
```

- [ ] **Step 2: Write API endpoints**

```typescript
// src/app/api/clients/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { clientService } from '@/lib/services/clientService'

export async function GET() {
  try {
    const clients = await clientService.listClients()
    return NextResponse.json(clients)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list clients' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const client = await clientService.createClient(body)
    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create client' }, { status: 400 })
  }
}

// src/app/api/clients/[id]/route.ts

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await clientService.getClient(params.id)
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(client)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const client = await clientService.updateClient(params.id, body)
    return NextResponse.json(client)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update client' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await clientService.deleteClient(params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clients/ src/lib/services/clientService.ts
git commit -m "feat: client and contact CRUD API"
```

---

### Task B4: API Endpoints — Contracts CRUD & State Transitions

**Files:**
- Create: `src/app/api/contrats/route.ts`
- Create: `src/app/api/contrats/[id]/route.ts`
- Create: `src/app/api/contrats/[id]/sign/route.ts`
- Create: `src/app/api/contrats/[id]/validate-bat/route.ts`

- [ ] **Step 1: Write Contrat CRUD endpoints**

```typescript
// src/app/api/contrats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { contratService } from '@/lib/services/contratService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId') || undefined
    const contrats = await contratService.listContrats(clientId)
    return NextResponse.json(contrats)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list contrats' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const contrat = await contratService.createContrat(body)
    return NextResponse.json(contrat, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create contrat' }, { status: 400 })
  }
}

// src/app/api/contrats/[id]/route.ts

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contrat = await contratService.getContrat(params.id)
    if (!contrat) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(contrat)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch contrat' }, { status: 500 })
  }
}

// src/app/api/contrats/[id]/sign/route.ts (state transition: draft → signed)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const userId = req.headers.get('X-User-ID') || 'unknown'
    
    const contrat = await contratService.signContrat(params.id, body.pdfUrl, userId)
    return NextResponse.json(contrat)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// src/app/api/contrats/[id]/validate-bat/route.ts

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get('X-User-ID') || 'unknown'
    
    const contrat = await contratService.validateBAT(params.id, userId)
    return NextResponse.json(contrat)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/contrats/
git commit -m "feat: contract CRUD and state machine endpoints (sign, validate BAT)"
```

---

### Task B5: Frontend — Clients & Contracts UI

**Files:**
- Create: `src/app/(dashboard)/clients/page.tsx`
- Create: `src/app/(dashboard)/clients/[id]/page.tsx`
- Create: `src/app/(dashboard)/contrats/page.tsx`
- Create: `src/app/(dashboard)/contrats/[id]/page.tsx`
- Create: `src/components/clients/ClientForm.tsx`
- Create: `src/components/clients/ClientList.tsx`
- Create: `src/components/contrats/ContratForm.tsx`
- Create: `src/components/contrats/ContratDetail.tsx`

**(Detailed React components similar to Task A3 — ClientList, ClientForm, ContratForm, ContratDetail with workflow buttons)**

- [ ] **Step 1-6: Write components** (Follow pattern from Task A3)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/clients/ src/app/\(dashboard\)/contrats/ src/components/clients/ src/components/contrats/
git commit -m "feat: client and contract UI (list, create, edit, state transitions)"
```

---

## BLOCK C: Invoicing (Facturation)

### Task C1: Database Schema — Invoices & Lignes

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/003_init_invoicing.sql`

- [ ] **Step 1: Add Invoice schemas**

```prisma
// Add to prisma/schema.prisma

model Invoice {
  id        String   @id @default(cuid())
  numero    String   @unique
  
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  
  lignes    InvoiceLigne[]
  
  // Generation (Éditer = générer + PDF)
  genereeAt DateTime?
  genereeBy String?
  pdfUrl    String?
  
  // Payment tracking
  montantTotal Float
  montantTaxe  Float  // TVA 20%
  montantNet   Float
  
  dateEchance  DateTime
  statut       String @default("draft")  // draft → generee → envoyee → payee / impayee
  
  // Relance paiement
  dernierRelanceDate DateTime?
  relanceCount Int @default(0)
  alerteImpayee Boolean @default(false)  // J-15 if impayee
  
  // Workflow
  submittedAt DateTime?
  submittedBy String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model InvoiceLigne {
  id        String   @id @default(cuid())
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  
  description String  // "Location face DIA-0001-A, nov 2026"
  faceId    String?
  montantHT Float
  tauxTaxe  Float @default(0.20)  // TVA 20%
  montantTTC Float
  
  createdAt DateTime @default(now())
}

model Payment {
  id        String   @id @default(cuid())
  invoiceId String?
  
  montant   Float
  dateReception DateTime
  modePayement String  // "virement", "cheque", "especes"
  
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init_invoicing
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: invoice schema with lignes and payment tracking"
```

---

### Task C2: PDF Generation Service (Puppeteer)

**Files:**
- Create: `src/lib/pdf.ts`
- Create: `src/lib/services/invoiceService.ts`

- [ ] **Step 1: Write PDF generation service**

```typescript
// src/lib/pdf.ts

import puppeteer from 'puppeteer'

export async function generateInvoicePDF(invoiceData: {
  numero: string
  client: { name: string; nif: string; stat?: string; rcs?: string }
  lignes: Array<{ description: string; montantHT: number; montantTTC: number }>
  montantTotal: number
  montantTaxe: number
  dateFacture: Date
  dateEchance: Date
}): Promise<Buffer> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .invoice-num { font-size: 24px; font-weight: bold; }
        .client-info { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #f0f0f0; padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        .total { font-weight: bold; background-color: #f9f9f9; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-num">FACTURE ${invoiceData.numero}</div>
        <div>Date: ${invoiceData.dateFacture.toLocaleDateString('fr-FR')}</div>
        <div>Échéance: ${invoiceData.dateEchance.toLocaleDateString('fr-FR')}</div>
      </div>

      <div class="client-info">
        <h3>${invoiceData.client.name}</h3>
        <div>NIF: ${invoiceData.client.nif}</div>
        ${invoiceData.client.stat ? `<div>STAT: ${invoiceData.client.stat}</div>` : ''}
        ${invoiceData.client.rcs ? `<div>RCS: ${invoiceData.client.rcs}</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Montant HT</th>
            <th style="text-align: right;">Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.lignes.map(ligne => `
            <tr>
              <td>${ligne.description}</td>
              <td style="text-align: right;">${ligne.montantHT.toFixed(2)} €</td>
              <td style="text-align: right;">${ligne.montantTTC.toFixed(2)} €</td>
            </tr>
          `).join('')}
          <tr class="total">
            <td colspan="2" style="text-align: right;">Sous-total HT:</td>
            <td style="text-align: right;">${(invoiceData.montantTotal - invoiceData.montantTaxe).toFixed(2)} €</td>
          </tr>
          <tr class="total">
            <td colspan="2" style="text-align: right;">TVA (20%):</td>
            <td style="text-align: right;">${invoiceData.montantTaxe.toFixed(2)} €</td>
          </tr>
          <tr class="total">
            <td colspan="2" style="text-align: right;">TOTAL TTC:</td>
            <td style="text-align: right;">${invoiceData.montantTotal.toFixed(2)} €</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p>RNA Panneau © 2026</p>
      </div>
    </body>
    </html>
  `

  await page.setContent(html)
  const pdfBuffer = await page.pdf({ format: 'A4', margin: '10mm' })
  await browser.close()

  return pdfBuffer
}
```

- [ ] **Step 2: Write InvoiceService with PDF generation**

```typescript
// src/lib/services/invoiceService.ts

import { prisma } from '@/lib/db'
import { generateInvoicePDF } from '@/lib/pdf'
import { workflowEngine } from '@/lib/workflow'
import { decryptField } from '@/lib/encryption'

export class InvoiceService {
  async createInvoice(data: {
    clientId: string
    lignes: Array<{ description: string; montantHT: number }>
    dateEchance: Date
  }) {
    const montantHT = data.lignes.reduce((sum, l) => sum + l.montantHT, 0)
    const montantTaxe = montantHT * 0.20
    const montantTotal = montantHT + montantTaxe

    return prisma.invoice.create({
      data: {
        numero: `INV-${Date.now()}`,  // Auto-increment in production
        clientId: data.clientId,
        dateEchance: data.dateEchance,
        montantTotal,
        montantTaxe,
        montantNet: montantHT,
        statut: 'draft',
        lignes: {
          create: data.lignes.map(l => ({
            description: l.description,
            montantHT: l.montantHT,
            montantTTC: l.montantHT * 1.20,
            tauxTaxe: 0.20
          }))
        }
      },
      include: { client: true, lignes: true }
    })
  }

  async generateInvoicePDF(invoiceId: string, userId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, lignes: true }
    })
    if (!invoice) throw new Error('Invoice not found')

    workflowEngine.validateTransition('invoice', invoice.statut, 'generee')

    // Decrypt client data
    const clientNIF = decryptField(invoice.client.nif)
    const clientSTAT = invoice.client.stat ? decryptField(invoice.client.stat) : undefined
    const clientRCS = invoice.client.rcs ? decryptField(invoice.client.rcs) : undefined

    const pdfBuffer = await generateInvoicePDF({
      numero: invoice.numero,
      client: {
        name: invoice.client.name,
        nif: clientNIF,
        stat: clientSTAT,
        rcs: clientRCS
      },
      lignes: invoice.lignes,
      montantTotal: invoice.montantTotal,
      montantTaxe: invoice.montantTaxe,
      dateFacture: new Date(),
      dateEchance: invoice.dateEchance
    })

    // Save PDF (to cloud storage in production, local for MVP)
    const pdfPath = `/tmp/invoice-${invoice.numero}.pdf`
    // In production: upload to S3/storage service

    // Update invoice status
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        statut: 'generee',
        genereeAt: new Date(),
        genereeBy: userId,
        pdfUrl: pdfPath
      }
    })

    return { invoice: updated, pdfBuffer }
  }

  async markAsSent(invoiceId: string) {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { statut: 'envoyee' }
    })
  }

  async markAsOverdue(invoiceId: string) {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { statut: 'impayee', alerteImpayee: true }
    })
  }

  async recordPayment(invoiceId: string, amount: float) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (invoice.montantTotal === amount) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { statut: 'payee' }
      })
    }
    return prisma.payment.create({
      data: {
        invoiceId,
        montant: amount,
        dateReception: new Date(),
        modePayement: 'virement'
      }
    })
  }

  async getInvoice(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { client: true, lignes: true }
    })
  }

  async listInvoices(clientId?: string, statut?: string) {
    return prisma.invoice.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(statut ? { statut } : {})
      },
      include: { client: true }
    })
  }
}

export const invoiceService = new InvoiceService()
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf.ts src/lib/services/invoiceService.ts
git commit -m "feat: PDF generation and invoice service"
```

---

### Task C3: API Endpoints — Invoices CRUD & Generate

**Files:**
- Create: `src/app/api/invoices/route.ts`
- Create: `src/app/api/invoices/[id]/route.ts`
- Create: `src/app/api/invoices/[id]/generate/route.ts`

- [ ] **Step 1: Write Invoice API endpoints**

```typescript
// src/app/api/invoices/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { invoiceService } from '@/lib/services/invoiceService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')
    const statut = searchParams.get('statut')
    
    const invoices = await invoiceService.listInvoices(clientId || undefined, statut || undefined)
    return NextResponse.json(invoices)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const invoice = await invoiceService.createInvoice(body)
    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 400 })
  }
}

// src/app/api/invoices/[id]/generate/route.ts

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get('X-User-ID') || 'unknown'
    const { invoice, pdfBuffer } = await invoiceService.generateInvoicePDF(params.id, userId)
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.numero}.pdf"`
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invoices/
git commit -m "feat: invoice CRUD and PDF generation endpoints"
```

---

### Task C4: Frontend — Invoices UI (List, Create, Generate PDF)

**Files:**
- Create: `src/app/(dashboard)/invoices/page.tsx`
- Create: `src/app/(dashboard)/invoices/new/page.tsx`
- Create: `src/app/(dashboard)/invoices/[id]/page.tsx`
- Create: `src/components/invoices/InvoiceList.tsx`
- Create: `src/components/invoices/InvoiceForm.tsx`
- Create: `src/components/invoices/InvoiceDetail.tsx`

**(Similar pattern to Task B5)**

- [ ] **Step 1-2: Write components**

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/invoices/ src/components/invoices/
git commit -m "feat: invoice UI (list, create, generate PDF)"
```

---

## BLOCK D: Alerts & Payment Relance

### Task D1: Database Schema — Alerts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/004_init_alerts.sql`

- [ ] **Step 1: Add Alert schema**

```prisma
// Add to prisma/schema.prisma

model Alert {
  id        String   @id @default(cuid())
  type      String   // "fin-contrat" | "impression-expiration" | "paiement-impaye" | "facture-non-generee"
  
  relatedId String   // contratId, faceId, invoiceId
  relatedType String  // "contrat", "face", "invoice"
  
  clientId  String?
  client    Client?  @relation(fields: [clientId], references: [id])
  
  statut    String   @default("pending")  // "pending" | "sent" | "acknowledged" | "resolved"
  
  dateAlert DateTime
  dateEnvoi DateTime?
  dateLecture DateTime?
  
  // Destination
  envoiEmail Boolean @default(true)
  envoiApp   Boolean @default(true)
  envoiClient Boolean @default(false)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // "create", "update", "delete", "generate-invoice", "send-relance"
  
  entityType String  // "Invoice", "Contrat", "Client"
  entityId  String
  
  oldValues Json?
  newValues Json?
  
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init_alerts
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: alert and audit log schema"
```

---

### Task D2: Alert Service & Background Jobs (Bull Queue)

**Files:**
- Create: `src/lib/services/alertService.ts`
- Create: `src/jobs/alertWorker.ts`
- Create: `src/jobs/paymentRelanceWorker.ts`
- Create: `src/lib/queue.ts`

- [ ] **Step 1: Write Alert Service**

```typescript
// src/lib/services/alertService.ts

import { prisma } from '@/lib/db'
import { alertQueue } from '@/lib/queue'

export class AlertService {
  async createAlert(data: {
    type: string
    relatedId: string
    relatedType: string
    clientId?: string
    dateAlert: Date
    envoiEmail?: boolean
    envoiApp?: boolean
    envoiClient?: boolean
  }) {
    const alert = await prisma.alert.create({ data })
    
    // Queue alert for sending
    await alertQueue.add('send-alert', { alertId: alert.id }, { delay: 0 })
    
    return alert
  }

  async createPaymentAlert(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true }
    })
    if (!invoice) return

    // Only alert if overdue (J-15 after invoice date)
    const invoiceDate = invoice.createdAt
    const daysSinceInvoice = Math.floor((Date.now() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceInvoice >= 15) {
      const existing = await prisma.alert.findFirst({
        where: { relatedId: invoiceId, type: 'paiement-impaye', statut: 'pending' }
      })
      
      if (!existing) {
        await this.createAlert({
          type: 'paiement-impaye',
          relatedId: invoiceId,
          relatedType: 'invoice',
          clientId: invoice.clientId,
          dateAlert: new Date(),
          envoiEmail: true,
          envoiApp: true,
          envoiClient: false
        })
      }
    }
  }

  async createEndContractAlert(contratId: string) {
    const contrat = await prisma.contrat.findUnique({
      where: { id: contratId },
      include: { client: true }
    })
    if (!contrat) return

    // Alert 30 days before contract end
    const daysTillEnd = Math.floor((contrat.dateFin.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    
    if (daysTillEnd <= 30 && daysTillEnd > 0) {
      const existing = await prisma.alert.findFirst({
        where: { relatedId: contratId, type: 'fin-contrat', statut: 'pending' }
      })
      
      if (!existing) {
        await this.createAlert({
          type: 'fin-contrat',
          relatedId: contratId,
          relatedType: 'contrat',
          clientId: contrat.clientId,
          dateAlert: new Date(),
          envoiEmail: true,
          envoiApp: true,
          envoiClient: true  // Can send to client
        })
      }
    }
  }

  async markAsSent(alertId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { statut: 'sent', dateEnvoi: new Date() }
    })
  }

  async markAsResolved(alertId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { statut: 'resolved' }
    })
  }

  async listPendingAlerts() {
    return prisma.alert.findMany({
      where: { statut: 'pending' }
    })
  }
}

export const alertService = new AlertService()
```

- [ ] **Step 2: Write Bull Queue setup**

```typescript
// src/lib/queue.ts

import Bull from 'bull'

export const alertQueue = new Bull('alerts', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
})

export const paymentRelanceQueue = new Bull('payment-relance', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
})
```

- [ ] **Step 3: Write Alert Worker (sends emails)**

```typescript
// src/jobs/alertWorker.ts

import { alertQueue } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { alertService } from '@/lib/services/alertService'
import { sendEmailNotification } from '@/lib/email'  // Resend/SendGrid

alertQueue.process(async (job) => {
  const { alertId } = job.data
  
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: { client: true }
  })
  
  if (!alert || alert.statut !== 'pending') return

  try {
    if (alert.envoiEmail) {
      await sendEmailNotification({
        to: alert.client?.email,
        subject: getAlertSubject(alert.type),
        body: getAlertBody(alert)
      })
    }
    
    if (alert.envoiApp) {
      // Log in-app notification (could be real-time via WebSocket)
      await prisma.alert.update({
        where: { id: alertId },
        data: { statut: 'acknowledged' }
      })
    }

    await alertService.markAsSent(alertId)
  } catch (err) {
    throw err  // Bull will retry
  }
})

function getAlertSubject(type: string): string {
  const subjects = {
    'fin-contrat': 'Alerte : Fin de contrat prévue',
    'paiement-impaye': 'Alerte : Facture impayée',
    'impression-expiration': 'Alerte : Impression en expiration',
    'facture-non-generee': 'Alerte : Facture non générée'
  }
  return subjects[type] || 'Nouvelle alerte'
}

function getAlertBody(alert: any): string {
  // Generate email HTML body based on alert type
  return `<p>Alert: ${alert.type}</p>`
}
```

- [ ] **Step 4: Write Payment Relance Worker (daily check)**

```typescript
// src/jobs/paymentRelanceWorker.ts

import { paymentRelanceQueue } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { alertService } from '@/lib/services/alertService'

// Schedule daily at 8 AM
export function schedulePaymentRelance() {
  paymentRelanceQueue.add(
    'check-overdue',
    {},
    { repeat: { cron: '0 8 * * *' } }  // 8 AM daily
  )
}

paymentRelanceQueue.process('check-overdue', async () => {
  const impayeeInvoices = await prisma.invoice.findMany({
    where: {
      statut: 'impayee',
      alerteImpayee: false
    }
  })

  for (const invoice of impayeeInvoices) {
    await alertService.createPaymentAlert(invoice.id)
  }
})
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/alertService.ts src/jobs/ src/lib/queue.ts
git commit -m "feat: alert service and background job workers (Bull)"
```

---

### Task D3: API Endpoints — Alerts & Relance

**Files:**
- Create: `src/app/api/alerts/route.ts`
- Create: `src/app/api/alerts/[id]/resolve/route.ts`
- Create: `src/app/api/relance/send/route.ts`

- [ ] **Step 1: Write Alert endpoints**

```typescript
// src/app/api/alerts/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { alertService } from '@/lib/services/alertService'

export async function GET() {
  try {
    const alerts = await alertService.listPendingAlerts()
    return NextResponse.json(alerts)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list alerts' }, { status: 500 })
  }
}

// src/app/api/alerts/[id]/resolve/route.ts

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const alert = await alertService.markAsResolved(params.id)
    return NextResponse.json(alert)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to resolve alert' }, { status: 400 })
  }
}

// src/app/api/relance/send/route.ts (Manual relance trigger)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoiceId } = body
    
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true }
    })

    if (invoice.statut !== 'impayee') {
      return NextResponse.json({ error: 'Invoice not overdue' }, { status: 400 })
    }

    // Create relance alert
    await alertService.createAlert({
      type: 'paiement-impaye',
      relatedId: invoiceId,
      relatedType: 'invoice',
      clientId: invoice.clientId,
      dateAlert: new Date(),
      envoiEmail: true,
      envoiClient: true
    })

    // Update invoice relance count
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        dernierRelanceDate: new Date(),
        relanceCount: { increment: 1 }
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send relance' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/alerts/ src/app/api/relance/
git commit -m "feat: alert management and payment relance endpoints"
```

---

## BLOCK E: Dashboard & Reporting

### Task E1: Dashboard Endpoints (KPIs & Metrics)

**Files:**
- Create: `src/app/api/dashboard/metrics/route.ts`
- Create: `src/lib/services/dashboardService.ts`

- [ ] **Step 1: Write Dashboard Service**

```typescript
// src/lib/services/dashboardService.ts

import { prisma } from '@/lib/db'

export class DashboardService {
  async getMetrics() {
    const totalBillboards = await prisma.billboard.count()
    const billboardsLibres = await prisma.billboard.count({ where: { statut: 'libre' } })
    const billboardsLoues = await prisma.billboard.count({ where: { statut: 'loue' } })
    
    const totalClients = await prisma.client.count()
    const totalContrats = await prisma.contrat.count({ where: { statut: 'active' } })
    
    const invoices = await prisma.invoice.findMany({
      where: { statut: { in: ['generee', 'envoyee'] } }
    })
    const caThisMonth = invoices.reduce((sum, i) => sum + i.montantTotal, 0)
    
    const impayees = await prisma.invoice.count({ where: { statut: 'impayee' } })
    const totalDette = await prisma.invoice.aggregate({
      _sum: { montantTotal: true },
      where: { statut: 'impayee' }
    })
    
    return {
      billboards: {
        total: totalBillboards,
        libres: billboardsLibres,
        tauxOccupation: ((billboardsLoues / totalBillboards) * 100).toFixed(1)
      },
      clients: {
        total: totalClients
      },
      contrats: {
        actifs: totalContrats
      },
      financials: {
        caThisMonth: caThisMonth.toFixed(2),
        facturesImpayees: impayees,
        detteTotale: (totalDette._sum.montantTotal || 0).toFixed(2)
      }
    }
  }

  async getInvoicesAtDueDate() {
    const now = new Date()
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    return prisma.invoice.findMany({
      where: {
        statut: { in: ['envoyee', 'impayee'] },
        dateEchance: { gte: now, lte: inSevenDays }
      },
      include: { client: true }
    })
  }
}

export const dashboardService = new DashboardService()
```

- [ ] **Step 2: Write Dashboard endpoints**

```typescript
// src/app/api/dashboard/metrics/route.ts

import { NextResponse } from 'next/server'
import { dashboardService } from '@/lib/services/dashboardService'

export async function GET() {
  try {
    const metrics = await dashboardService.getMetrics()
    const dueSoon = await dashboardService.getInvoicesAtDueDate()
    
    return NextResponse.json({ metrics, dueSoon })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/dashboardService.ts src/app/api/dashboard/
git commit -m "feat: dashboard metrics and KPI endpoints"
```

---

### Task E2: Dashboard Frontend (React Components)

**Files:**
- Create: `src/app/(dashboard)/page.tsx`
- Create: `src/components/dashboard/KPICard.tsx`
- Create: `src/components/dashboard/MetricsGrid.tsx`
- Create: `src/components/dashboard/InvoicesDue.tsx`

**(React dashboard with KPI cards, charts, invoice table)**

- [ ] **Step 1-2: Write dashboard components**

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx src/components/dashboard/
git commit -m "feat: dashboard UI with KPIs and invoice due list"
```

---

## BLOCK F: Auth & Permissions (Foundation)

### Task F1: Setup Auth (NextAuth.js)

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`

**(NextAuth.js setup with JWT, simple email/password for MVP)**

- [ ] **Step 1-2: Write auth setup**

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/ src/lib/auth.ts
git commit -m "feat: NextAuth.js setup with JWT"
```

---

### Task F2: Add Encryption for Sensitive Fields

**Files:**
- Create: `src/lib/encryption.ts`

- [ ] **Step 1: Write encryption utils**

```typescript
// src/lib/encryption.ts

import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key'

export function encryptField(value: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  
  let encrypted = cipher.update(value)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptField(encrypted: string): string {
  const parts = encrypted.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  
  let decrypted = decipher.update(Buffer.from(parts[1], 'hex'))
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/encryption.ts
git commit -m "feat: encryption utils for sensitive fields (NIF, STAT, RCS)"
```

---

## Summary & Next Steps

All 5 blocks implemented:
- ✅ Block A: Billboards & Impressions (CRUD, UI)
- ✅ Block B: CRM Client + Contracts/BC (ERPNext state machine pattern)
- ✅ Block C: Invoicing (PDF generation, workflow)
- ✅ Block D: Alerts & Payment Relance (Bull queue background jobs)
- ✅ Block E: Dashboard (KPIs, metrics, reporting)
- ✅ Block F: Auth & Encryption (foundation)

Each block is self-contained, testable, and follows ERPNext patterns adapted to Next.js/Node stack.

**Execution Ready:**

After plan approval, use **superpowers:subagent-driven-development** to execute task-by-task with two-stage review (spec compliance + code quality).
