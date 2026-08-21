# V2 — Panneaux 2 faces, clients, filtres — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the V2 scope agreed with the client: multi-face contracts (a 2-face billboard can have up to 2 simultaneous clients, or one client on both faces), client CRUD (delete with double confirmation), billboard notes, GPS/BD-based billboard creation, client filtering, an admin-editable city→reference-prefix table, a status-color legend, and a logout button.

**Architecture:** Additive schema changes to the existing Prisma models (no renames of existing fields except `Client.contactInfo` → `phone`/`email`). The biggest structural change is `Contract.face` (`FACE_1` | `FACE_2` | `BOTH`), which lets `deriveBillboardStatus` and the contract-creation flow reason about up to two concurrent ACTIVE contracts per billboard instead of assuming one. Everything else (notes, city prefixes, client delete, filters) is a straightforward extension of the existing CRUD/approval patterns already used throughout the app.

**Tech Stack:** Same as V1 — Next.js App Router, Prisma 7 + PrismaPg adapter, Zod, Tailwind/shadcn, Vitest.

---

## Context you need before starting

- `deriveBillboardStatus` (`src/lib/status.ts`) currently assumes **at most one ACTIVE contract per billboard**. This assumption is being removed in Task 8.
- `POST /api/contracts` (`src/app/api/contracts/route.ts:40-42`) has a documented known limitation: no guard against overlapping ACTIVE contracts. Task 7 replaces this with a real occupancy check now that overlap is an expected case (2 faces) rather than a bug.
- There is currently **no UI to create a contract at all** — `ContractPanel` only shows a terminate button when a contract already exists. Task 9 adds the missing "Nouveau contrat" form.
- City reference prefixes are currently a hardcoded map in `src/lib/reference.ts` with only 6 entries, some of which are wrong relative to the client's real usage (e.g. it guesses `Fianarantsoa: 'FIA'`, but the client's spreadsheets show they actually use `WFI`). Task 2 replaces this with a DB-backed, admin-editable table seeded from the client's real historical data (extracted from `base de donnée.xlsx` and `Sucettes YAS.xlsx`).
- Two naming collisions exist in the client's own historical data and needed a judgment call (flagged inline in Task 2, seed to be reviewed by the client via the new admin UI):
  - `WAI` was used for both Ambositra (10 rows) and Antsohihy (16 rows). Antsohihy keeps `WAI`; Ambositra is seeded with `AOT` instead.
  - `TMM` was used for both Tamatave (14 rows, and it's Tamatave's real IATA code) and Fenerive Est (10 rows, likely a copy-paste error in the source spreadsheet). Tamatave keeps `TMM`; Fenerive Est is seeded with `FIE` instead.

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts:28` (contactInfo → phone/email)

- [ ] **Step 1: Edit the schema**

Replace the whole file with:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  DEV
  ADMIN
  USER
}

enum Dimension {
  D2X1
  D4X3
  D6X3
  D8X3
  D12X3
}

enum ContractStatus {
  ACTIVE
  EXPIRED
  TERMINATED
}

enum ContractFace {
  FACE_1
  FACE_2
  BOTH
}

enum ApprovalType {
  CREATE_CONTRACT
  EDIT_CONTRACT
  DELETE_BILLBOARD
  DELETE_CLIENT
  EDIT_PRICE
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(USER)
  createdAt    DateTime @default(now())

  approvalRequests   ApprovalRequest[]   @relation("RequestedBy")
  reviewedApprovals  ApprovalRequest[]   @relation("ReviewedBy")
  maintenanceRecords MaintenanceRecord[]
}

model Billboard {
  id              String    @id @default(cuid())
  reference       String    @unique
  lat             Float
  lng             Float
  city            String
  dimension       Dimension
  sides           Int       @default(1)
  damaged         Boolean   @default(false)
  currentPhotoUrl String?
  note            String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  contracts          Contract[]
  maintenanceRecords MaintenanceRecord[]
}

model Client {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  email     String?
  createdAt DateTime @default(now())

  contracts Contract[]
}

model Contract {
  id          String         @id @default(cuid())
  billboardId String
  clientId    String
  face        ContractFace   @default(BOTH)
  startDate   DateTime
  endDate     DateTime
  amount      Float
  status      ContractStatus @default(ACTIVE)
  createdAt   DateTime       @default(now())

  billboard Billboard @relation(fields: [billboardId], references: [id])
  client    Client    @relation(fields: [clientId], references: [id])

  @@index([billboardId])
  @@index([clientId])
}

model MaintenanceRecord {
  id           String   @id @default(cuid())
  billboardId  String
  date         DateTime
  type         String
  comment      String?
  technicianId String?

  billboard  Billboard @relation(fields: [billboardId], references: [id])
  technician User?     @relation(fields: [technicianId], references: [id])

  @@index([billboardId])
  @@index([technicianId])
}

model ApprovalRequest {
  id            String         @id @default(cuid())
  requestedById String
  type          ApprovalType
  payload       Json
  status        ApprovalStatus @default(PENDING)
  reviewedById  String?
  reviewedAt    DateTime?
  createdAt     DateTime       @default(now())

  requestedBy User  @relation("RequestedBy", fields: [requestedById], references: [id])
  reviewedBy  User? @relation("ReviewedBy", fields: [reviewedById], references: [id])

  @@index([requestedById])
  @@index([reviewedById])
}

model CityPrefix {
  id     String @id @default(cuid())
  city   String @unique
  prefix String
}
```

- [ ] **Step 2: Update seed.ts's contactInfo reference**

In `prisma/seed.ts:28`, change:
```ts
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', contactInfo: 'contact@orange.mg' },
```
to:
```ts
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', email: 'contact@orange.mg' },
```

- [ ] **Step 3: Generate the migration**

Run: `npx prisma migrate dev --name v2_faces_notes_clients_cityprefix`
Expected: migration created and applied, `Client.contactInfo` data is dropped (no production data exists yet at this stage — confirm with `docker compose exec db psql -U rna -d rna_panneaux -c "select count(*) from \"Client\";"` before running if you want to be safe; the only client row today is the seed row, safe to drop).

- [ ] **Step 4: Regenerate the Prisma client and confirm the app still builds**

Run: `npx prisma generate && npm run build`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/migrations
git commit -m "feat(db): add Contract.face, Billboard.note, Client phone/email, CityPrefix"
```

---

### Task 2: City-prefix lookup table (seed + generateReference + admin CRUD)

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/lib/reference.ts`
- Modify: `src/app/api/billboards/route.ts:47-48`
- Create: `src/app/api/city-prefixes/route.ts`
- Create: `src/app/settings/city-prefixes/page.tsx`
- Test: `tests/lib/reference.test.ts`

- [ ] **Step 1: Seed the city-prefix table with the client's real historical data**

Append to `prisma/seed.ts`, calling it from `main()`:

```ts
async function seedCityPrefixes() {
  // Extracted from the client's "base de donnée.xlsx" and "Sucettes YAS.xlsx".
  // Two collisions existed in their own data and were resolved by picking the
  // higher-frequency usage; the loser gets a distinct fallback code (flagged
  // below). Editable afterwards via /settings/city-prefixes.
  const entries: { city: string; prefix: string }[] = [
    { city: 'Antananarivo', prefix: 'TNR' },
    { city: 'Tana', prefix: 'TNR' },
    { city: 'Toamasina', prefix: 'TMM' },
    { city: 'Tamatave', prefix: 'TMM' },
    { city: 'Fianarantsoa', prefix: 'WFI' },
    { city: 'Mahajanga', prefix: 'MJN' },
    { city: 'Majunga', prefix: 'MJN' },
    { city: 'Toliara', prefix: 'TLE' },
    { city: 'Tulear', prefix: 'TLE' },
    { city: 'Antsiranana', prefix: 'DIE' },
    { city: 'Diego', prefix: 'DIE' },
    { city: 'Ambanja', prefix: 'IVA' },
    { city: 'Ambatondrazaka', prefix: 'WAM' },
    { city: 'Ambilobe', prefix: 'AMB' },
    // Collision with Antsohihy (WAI, 16 occurrences vs this city's 10) — was
    // WAI in the source data, reassigned. Confirm/rename via the admin UI.
    { city: 'Ambositra', prefix: 'AOT' },
    { city: 'Andapa', prefix: 'ZWA' },
    { city: 'Antalaha', prefix: 'ANM' },
    { city: 'Antsohihy', prefix: 'WAI' },
    { city: 'Arivonimamo', prefix: 'FMMA' },
    { city: 'Befandriana Nord', prefix: 'WBD' },
    // Collision with Tamatave (TMM is Tamatave's real IATA code, and it has
    // more occurrences) — was TMM in the source data, reassigned. Likely a
    // copy-paste error in the client's spreadsheet; confirm via admin UI.
    { city: 'Fenerive Est', prefix: 'FIE' },
    { city: 'Fort Dauphin', prefix: 'FTU' },
    { city: 'Maevatanana', prefix: 'FMNP' },
    { city: 'Mampikony', prefix: 'WMP' },
    { city: 'Mandritsara', prefix: 'WMA' },
    { city: 'Maroantsetra', prefix: 'WMN' },
    { city: 'Moramanga', prefix: 'OHB' },
    { city: 'Morondava', prefix: 'MOQ' },
    { city: 'Nosy Be', prefix: 'NOS' },
    { city: 'Port Berger', prefix: 'WPB' },
    { city: 'Sambava', prefix: 'SVB' },
    { city: 'Ste Marie', prefix: 'SMS' },
    { city: 'Vatomandry', prefix: 'VAT' },
    { city: 'Vohemar', prefix: 'VOH' },
  ]

  for (const e of entries) {
    await prisma.cityPrefix.upsert({
      where: { city: e.city },
      update: {},
      create: e,
    })
  }
}
```

And in `main()`, add the call:
```ts
  await seedSampleData()
  await seedCityPrefixes()
```

- [ ] **Step 2: Write the failing test for prefix resolution**

Create `tests/lib/reference.test.ts` (replacing the existing file — it currently tests the old hardcoded map):

```ts
import { describe, it, expect } from 'vitest'
import { generateReference, resolveCityPrefix } from '@/lib/reference'

describe('resolveCityPrefix', () => {
  it('matches a known city case-insensitively', () => {
    expect(resolveCityPrefix('antananarivo', [{ city: 'Antananarivo', prefix: 'TNR' }])).toBe('TNR')
  })

  it('falls back to the first 3 letters uppercased when no match exists', () => {
    expect(resolveCityPrefix('Nouvelleville', [])).toBe('NOU')
  })
})

describe('generateReference', () => {
  it('pads sequence to 3 digits and uses the resolved prefix', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo', prefixes: [{ city: 'Antananarivo', prefix: 'TNR' }] })).toBe(
      'ANM 001 TNR'
    )
  })

  it('does not pad sequences over 999', () => {
    expect(generateReference({ sequence: 1200, city: 'Diego', prefixes: [{ city: 'Diego', prefix: 'DIE' }] })).toBe(
      'ANM 1200 DIE'
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/reference.test.ts`
Expected: FAIL — `resolveCityPrefix` is not exported / `generateReference` signature mismatch.

- [ ] **Step 4: Rewrite `src/lib/reference.ts`**

```ts
export function resolveCityPrefix(city: string, prefixes: { city: string; prefix: string }[]): string {
  const match = prefixes.find((p) => p.city.toLowerCase() === city.toLowerCase())
  return match ? match.prefix : city.slice(0, 3).toUpperCase()
}

export function generateReference({
  sequence,
  city,
  prefixes,
}: {
  sequence: number
  city: string
  prefixes: { city: string; prefix: string }[]
}): string {
  const padded = String(sequence).padStart(3, '0')
  return `ANM ${padded} ${resolveCityPrefix(city, prefixes)}`
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/reference.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Wire the new signature into `POST /api/billboards`**

In `src/app/api/billboards/route.ts`, replace lines 47-48:
```ts
  const count = await prisma.billboard.count({ where: { city: body.city } })
  const reference = generateReference({ sequence: count + 1, city: body.city })
```
with:
```ts
  const [count, prefixes] = await Promise.all([
    prisma.billboard.count({ where: { city: body.city } }),
    prisma.cityPrefix.findMany(),
  ])
  const reference = generateReference({ sequence: count + 1, city: body.city, prefixes })
```

- [ ] **Step 7: Add the admin CRUD API for city prefixes**

Create `src/app/api/city-prefixes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  const prefixes = await prisma.cityPrefix.findMany({ orderBy: { city: 'asc' } })
  return NextResponse.json(prefixes)
}

const upsertSchema = z.object({
  city: z.string().trim().min(1),
  prefix: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .transform((s) => s.toUpperCase()),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseOrBadRequest(upsertSchema, await req.json())
  if ('error' in parsed) return parsed.error

  const entry = await prisma.cityPrefix.upsert({
    where: { city: parsed.data.city },
    update: { prefix: parsed.data.prefix },
    create: parsed.data,
  })
  return NextResponse.json(entry, { status: 201 })
}
```

- [ ] **Step 8: Add the admin settings page**

Create `src/app/settings/city-prefixes/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type CityPrefix = { id: string; city: string; prefix: string }

export default function CityPrefixesPage() {
  const [prefixes, setPrefixes] = useState<CityPrefix[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')
  const [prefix, setPrefix] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/city-prefixes')
      .then((r) => r.json())
      .then((data: CityPrefix[]) => setPrefixes(data))
      .finally(() => setLoading(false))
  }, [reloadToken])

  const save = async (targetCity: string, targetPrefix: string) => {
    setError(null)
    const res = await fetch('/api/city-prefixes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: targetCity, prefix: targetPrefix }),
    })
    if (!res.ok) {
      setError('Erreur lors de la sauvegarde')
      return
    }
    setCity('')
    setPrefix('')
    setReloadToken((t) => t + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Préfixes de référence par ville</h1>
      <p className="text-sm text-slate-600">
        Utilisé pour générer la référence des panneaux (ex: ANM 001 TNR). Une ville non listée ici
        utilise automatiquement ses 3 premières lettres en majuscules.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-end gap-2 rounded-lg border p-3">
        <div className="space-y-1">
          <Label>Ville</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Préfixe</Label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-24" />
        </div>
        <Button onClick={() => save(city, prefix)} disabled={!city.trim() || !prefix.trim()}>
          Ajouter / modifier
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {prefixes.map((p) => (
            <li key={p.id} className="flex items-center justify-between p-2 text-sm">
              <span>{p.city}</span>
              <Input
                defaultValue={p.prefix}
                className="w-24"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== p.prefix) {
                    save(p.city, e.target.value.trim())
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 9: Add the settings link to Nav (ADMIN/DEV only)**

This is folded into Task 14 (Nav changes) to avoid touching Nav.tsx twice — see Task 14 Step 1, which adds this link alongside the logout button.

- [ ] **Step 10: Verify build and tests**

Run: `npm run build && npx vitest run`
Expected: clean build, all tests pass.

- [ ] **Step 11: Commit**

```bash
git add prisma/seed.ts src/lib/reference.ts src/app/api/billboards/route.ts src/app/api/city-prefixes tests/lib/reference.test.ts src/app/settings
git commit -m "feat: admin-editable city-prefix table for billboard reference generation"
```

---

### Task 3: Billboard note field

**Files:**
- Modify: `src/app/api/billboards/route.ts` (create schema)
- Modify: `src/app/api/billboards/[id]/route.ts` (patch schema)
- Modify: `src/components/billboard/BillboardForm.tsx`
- Modify: `src/components/table/BillboardTable.tsx`
- Modify: `src/hooks/useBillboards.ts`
- Modify: `src/app/billboards/[id]/page.tsx`

- [ ] **Step 1: Allow `note` on create and patch**

In `src/app/api/billboards/route.ts`, add `note: z.string().trim().max(2000).optional()` to `createSchema`.

In `src/app/api/billboards/[id]/route.ts`, add `note: z.string().trim().max(2000).optional()` to `patchSchema`. `note` is **not** added to `RESTRICTED_FIELDS` — any role can add/edit a note (same rationale as `damaged`/`currentPhotoUrl`: field staff need to leave notes without going through approval).

- [ ] **Step 2: Add the note field to `BillboardForm`**

In `src/components/billboard/BillboardForm.tsx`:
- Add `export type EditableBillboard = { id: string; city: string; dimension: string; sides: number; note?: string | null }` (extends the existing type).
- Add state: `const [note, setNote] = useState(initial?.note ?? '')`.
- Include `note: note.trim() || undefined` in both the `create` and `edit` request bodies.
- Add a textarea field in the form body, after the "Faces" select:

```tsx
          <div className="space-y-1">
            <Label>Note</Label>
            <textarea
              className="w-full rounded-md border border-slate-200 p-2 text-sm"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
```

- [ ] **Step 3: Show the note column in the table**

In `src/components/table/BillboardTable.tsx`:
- Add `note?: string | null` to `BillboardRow`.
- Add a `<TableHead>Note</TableHead>` after the "Client"/"Clients" header (this header is renamed to plural in Task 11 — add the Note column after whatever that header ends up being).
- Add `<TableCell className="max-w-[200px] truncate">{r.note ?? '—'}</TableCell>` in the row.

- [ ] **Step 4: Thread `note` through `useBillboards`**

In `src/hooks/useBillboards.ts`, add `note?: string | null` to `ApiBillboard` and to the object returned by `toRow`.

- [ ] **Step 5: Show the note, GPS coordinates, and creation date on the billboard detail page**

The client's requested field list includes coordinates and creation date, which exist in the database (`lat`, `lng`, `createdAt`) but are never displayed anywhere in the UI today. In `src/app/billboards/[id]/page.tsx`, after the city/dimension/sides paragraph (line 32), add:

```tsx
          <p className="mt-1 text-sm text-slate-500">
            {billboard.lat.toFixed(5)}, {billboard.lng.toFixed(5)} — créé le {billboard.createdAt.toLocaleDateString('fr-FR')}
          </p>
          {billboard.note && <p className="mt-1 text-sm text-slate-500">Note : {billboard.note}</p>}
```

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/billboards src/components/billboard/BillboardForm.tsx src/components/table/BillboardTable.tsx src/hooks/useBillboards.ts src/app/billboards/[id]/page.tsx
git commit -m "feat: add a free-text note field to billboards"
```

---

### Task 4: Client phone/email fields

**Files:**
- Modify: `src/components/clients/ClientForm.tsx`
- Modify: `src/app/api/clients/route.ts`
- Modify: `src/app/clients/page.tsx`
- Modify: `src/app/clients/[id]/page.tsx`

- [ ] **Step 1: Update the create-client API schema**

In `src/app/api/clients/route.ts`, replace:
```ts
const createSchema = z.object({ name: z.string().min(1), contactInfo: z.string().optional() })
```
with:
```ts
const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
})
```

- [ ] **Step 2: Rewrite `ClientForm`**

In `src/components/clients/ClientForm.tsx`, replace the single `contactInfo` state/input with `phone`/`email`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ClientForm({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      setName('')
      setPhone('')
      setEmail('')
      onOpenChange(false)
      onCreated()
    } catch {
      setError('Erreur lors de la création du client')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Nom de l&apos;entreprise</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Téléphone (optionnel)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email (optionnel)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !name.trim()}>
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Update the clients list page**

In `src/app/clients/page.tsx`:
- Change `type Client = { id: string; name: string; contactInfo: string | null }` to `type Client = { id: string; name: string; phone: string | null; email: string | null }`.
- Replace `<p className="text-sm text-slate-500">{c.contactInfo}</p>` with:
```tsx
              <p className="text-sm text-slate-500">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</p>
```

- [ ] **Step 4: Update the client detail page**

Read `src/app/clients/[id]/page.tsx` first to find where `contactInfo` is rendered, and apply the same `[phone, email].filter(Boolean).join(' · ')` replacement there.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: clean build (this will surface any other `contactInfo` references — grep for `contactInfo` across `src/` and fix any remaining ones before moving on).

- [ ] **Step 6: Commit**

```bash
git add src/components/clients/ClientForm.tsx src/app/api/clients/route.ts src/app/clients
git commit -m "feat: split client contactInfo into optional phone and email fields"
```

---

### Task 5: Client delete — API (block if contracts exist, approval if USER)

**Files:**
- Modify: `src/app/api/clients/[id]/route.ts`
- Modify: `src/app/api/approvals/[id]/route.ts` (applyApproval switch)
- Modify: `src/components/approvals/ApprovalQueue.tsx` (resolved-name display)

- [ ] **Step 1: Add `DELETE` to `src/app/api/clients/[id]/route.ts`**

```ts
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'DELETE_CLIENT', { clientId: params.id })
  }

  const contractCount = await prisma.contract.count({ where: { clientId: params.id } })
  if (contractCount > 0) {
    return NextResponse.json(
      { error: 'Ce client a des contrats associés (actifs ou passés) et ne peut pas être supprimé.' },
      { status: 409 }
    )
  }

  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
```

Add `createApprovalRequest` to the imports from `@/lib/api-helpers` at the top of the file.

- [ ] **Step 2: Handle `DELETE_CLIENT` in `applyApproval`**

In `src/app/api/approvals/[id]/route.ts`, add a case before `default`:

```ts
    case 'DELETE_CLIENT': {
      const contractCount = await tx.contract.count({ where: { clientId: data.clientId as string } })
      if (contractCount > 0) {
        throw new Error('Client has associated contracts, cannot delete')
      }
      await tx.client.delete({ where: { id: data.clientId as string } })
      break
    }
```

Note: this throws inside the `$transaction`, which the route's existing `catch` block already turns into a 400 response for `PrismaClientKnownRequestError` — but a plain `Error` thrown here won't match that `instanceof` check and will re-throw as an unhandled 500. That's acceptable for now (an ADMIN approving a stale request where the client acquired contracts between request and approval is a rare edge case), but the approval stays PENDING since the transaction rolls back — the admin can just reject it instead. Confirm this behavior manually in Step 4 below rather than changing the route's error handling (out of scope for this task).

- [ ] **Step 3: Show the client name in the approval queue instead of a raw ID**

Read `src/app/api/approvals/route.ts` to see how `resolvedNames` is built for other approval types (e.g. `DELETE_BILLBOARD` resolving to a billboard reference), and add the equivalent lookup for `DELETE_CLIENT` — resolve `payload.clientId` to the client's `name` the same way. Read `src/components/approvals/ApprovalQueue.tsx` to confirm `DELETE_CLIENT` payloads render using the same `resolvedNames` fallback pattern already used for other types — if the component already falls back generically to any `resolvedNames[value]` lookup keyed by field name, no component change is needed; only extend the API route.

- [ ] **Step 4: Manual verification**

Run `docker compose up -d db && npm run dev`, log in as ADMIN, and:
- Try deleting the seeded client (`Orange Madagascar`) — expect a 409 blocked response (it has `seed-contract-1`).
- Create a client with no contracts, delete it — expect success.
- Log in as USER, delete a client — expect it to appear in the ADMIN's approval queue with the client's name shown (not a raw ID).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/clients/[id]/route.ts src/app/api/approvals prisma/schema.prisma
git commit -m "feat: client deletion (blocked if contracts exist, approval flow for USER)"
```

---

### Task 6: Client delete — UI (double confirmation by typing the name)

**Files:**
- Create: `src/components/shared/ConfirmDeleteDialog.tsx`
- Modify: `src/app/clients/[id]/page.tsx`

- [ ] **Step 1: Create a reusable type-to-confirm dialog**

Create `src/components/shared/ConfirmDeleteDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  entityName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  entityName: string
  onConfirm: () => Promise<void>
}) {
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = typed.trim() === entityName

  const confirm = async () => {
    if (!matches) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
      setTyped('')
    } catch {
      setError('Erreur lors de la suppression')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Supprimer {entityLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-sm text-slate-600">
            Cette action est irréversible. Pour confirmer, tapez exactement <strong>{entityName}</strong> ci-dessous.
          </p>
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={confirm}
            disabled={!matches || submitting}
          >
            {submitting ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire it into the client detail page**

Read `src/app/clients/[id]/page.tsx` fully first (it's a Server Component per the existing pattern — check whether it already has a client-side actions wrapper like `BillboardDetailActions`; if not, create one, e.g. `src/components/clients/ClientDetailActions.tsx`, following exactly the pattern of `src/components/billboard/BillboardDetailActions.tsx`: `'use client'`, `useSession()` with `status === 'authenticated'` fail-closed role check, renders a "Supprimer" button visible only to ADMIN/DEV, opens `ConfirmDeleteDialog`, calls `fetch('/api/clients/${id}', { method: 'DELETE' })` in `onConfirm`, then `router.push('/clients')` on success (the client no longer exists, so `router.refresh()` on the same page would 404)).

- [ ] **Step 3: Manual verification**

As ADMIN, open a client with no contracts, click "Supprimer", verify the button stays disabled until the exact name is typed, confirm, and verify redirect to `/clients` with the client gone.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ConfirmDeleteDialog.tsx src/components/clients src/app/clients/[id]/page.tsx
git commit -m "feat: type-to-confirm deletion UI for clients"
```

---

### Task 7: Contract face occupancy validation

**Files:**
- Create: `src/lib/contract-occupancy.ts`
- Modify: `src/app/api/contracts/route.ts`
- Modify: `src/app/api/approvals/[id]/route.ts` (CREATE_CONTRACT case)
- Test: `tests/lib/contract-occupancy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/contract-occupancy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isFaceAvailable } from '@/lib/contract-occupancy'

describe('isFaceAvailable', () => {
  it('allows BOTH when no active contracts exist', () => {
    expect(isFaceAvailable('BOTH', [])).toBe(true)
  })

  it('allows FACE_1 when only FACE_2 is active', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'FACE_2' }])).toBe(true)
  })

  it('blocks FACE_1 when FACE_1 is already active', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'FACE_1' }])).toBe(false)
  })

  it('blocks FACE_1 when BOTH is already active', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'BOTH' }])).toBe(false)
  })

  it('blocks BOTH when any face is already active', () => {
    expect(isFaceAvailable('BOTH', [{ face: 'FACE_1' }])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/contract-occupancy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/contract-occupancy.ts`**

```ts
export type ContractFace = 'FACE_1' | 'FACE_2' | 'BOTH'

/** True if `requestedFace` does not overlap any already-active face. */
export function isFaceAvailable(
  requestedFace: ContractFace,
  activeContracts: { face: ContractFace }[]
): boolean {
  if (activeContracts.some((c) => c.face === 'BOTH')) return false
  if (requestedFace === 'BOTH') return activeContracts.length === 0
  return !activeContracts.some((c) => c.face === requestedFace)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/contract-occupancy.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire the check into `POST /api/contracts`**

In `src/app/api/contracts/route.ts`:
- Add `face: z.enum(['FACE_1', 'FACE_2', 'BOTH']).default('BOTH')` to `createSchema`.
- Import `isFaceAvailable` from `@/lib/contract-occupancy`.
- Replace the comment block at lines 40-42 and the direct `prisma.contract.create` call with:

```ts
  const activeContracts = await prisma.contract.findMany({
    where: { billboardId: body.billboardId, status: 'ACTIVE' },
    select: { face: true },
  })
  if (!isFaceAvailable(body.face, activeContracts)) {
    return NextResponse.json({ error: 'Cette face du panneau est déjà louée' }, { status: 409 })
  }

  const contract = await prisma.contract.create({
    data: {
      billboardId: body.billboardId,
      clientId: body.clientId,
      face: body.face,
      startDate,
      endDate,
      amount: body.amount,
    },
  })
  return NextResponse.json(contract, { status: 201 })
```

- Also add `face: body.face` to the `createApprovalRequest(session, 'CREATE_CONTRACT', {...})` payload for the USER branch above it, and update its adjacent comment to mention the new `face` field.

- [ ] **Step 6: Apply the same check in the approval path**

In `src/app/api/approvals/[id]/route.ts`, in the `CREATE_CONTRACT` case, add the same occupancy check before creating the contract (an approval can be stale by the time an admin approves it — the face may have been taken by another contract in the meantime):

```ts
    case 'CREATE_CONTRACT': {
      const face = (data.face as 'FACE_1' | 'FACE_2' | 'BOTH') ?? 'BOTH'
      const activeContracts = await tx.contract.findMany({
        where: { billboardId: data.billboardId as string, status: 'ACTIVE' },
        select: { face: true },
      })
      if (!isFaceAvailable(face, activeContracts)) {
        throw new Error('Face already occupied')
      }
      await tx.contract.create({
        data: {
          billboardId: data.billboardId as string,
          clientId: data.clientId as string,
          face,
          startDate: new Date(data.startDate as string),
          endDate: new Date(data.endDate as string),
          amount: data.amount as number,
        },
      })
      break
    }
```

Import `isFaceAvailable` at the top of this file too.

- [ ] **Step 7: Build and test check**

Run: `npm run build && npx vitest run`
Expected: clean build, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/contract-occupancy.ts src/app/api/contracts/route.ts src/app/api/approvals/[id]/route.ts tests/lib/contract-occupancy.test.ts
git commit -m "feat: enforce per-face contract occupancy (FACE_1/FACE_2/BOTH)"
```

---

### Task 8: Multi-face status derivation

**Files:**
- Modify: `src/lib/status.ts`
- Test: `tests/lib/status.test.ts`

- [ ] **Step 1: Write the new failing tests**

Add to `tests/lib/status.test.ts` (keep the existing tests, which still pass unchanged since they use a single-contract array):

```ts
  it('returns the most urgent status across two active faces', () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const later = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000)
    const status = deriveBillboardStatus({
      damaged: false,
      contracts: [
        { status: 'ACTIVE', endDate: soon, face: 'FACE_1' },
        { status: 'ACTIVE', endDate: later, face: 'FACE_2' },
      ],
    })
    expect(status).toBe('EXPIRING_SOON')
  })

  it('is AVAILABLE only when no face has an active contract', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      contracts: [{ status: 'TERMINATED', endDate: new Date(), face: 'FACE_1' }],
    })
    expect(status).toBe('AVAILABLE')
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/lib/status.test.ts`
Expected: FAIL — `face` isn't part of the current type signature yet, and the current implementation only looks at a single contract so results won't match for the two-face case as written (TypeScript error, not just an assertion failure).

- [ ] **Step 3: Rewrite `src/lib/status.ts`**

```ts
export type BillboardStatus =
  | 'AVAILABLE'
  | 'RENTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'MAINTENANCE'

const EXPIRING_SOON_WINDOW_DAYS = 30
// Most urgent first: an EXPIRED face outranks a RENTED one on the same billboard.
const STATUS_PRIORITY: BillboardStatus[] = ['EXPIRED', 'EXPIRING_SOON', 'RENTED', 'AVAILABLE']

function faceStatus(endDate: Date): 'EXPIRED' | 'EXPIRING_SOON' | 'RENTED' {
  const daysUntilEnd = (endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  if (daysUntilEnd < 0) return 'EXPIRED'
  if (daysUntilEnd <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'
  return 'RENTED'
}

export function deriveBillboardStatus(billboard: {
  damaged: boolean
  contracts: { status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'; endDate: Date; face: 'FACE_1' | 'FACE_2' | 'BOTH' }[]
}): BillboardStatus {
  if (billboard.damaged) return 'MAINTENANCE'

  const activeContracts = billboard.contracts.filter((c) => c.status === 'ACTIVE')
  if (activeContracts.length === 0) return 'AVAILABLE'

  const statuses = activeContracts.map((c) => faceStatus(c.endDate))
  return STATUS_PRIORITY.find((s) => statuses.includes(s)) ?? 'AVAILABLE'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/status.test.ts`
Expected: PASS (7 tests — 5 existing + 2 new)

- [ ] **Step 5: Fix the two other callers that build the `contracts` array without `face`**

Grep for `deriveBillboardStatus(` across `src/` (it's called from `src/app/api/billboards/route.ts`, `src/app/api/billboards/[id]/route.ts`, and `src/app/dashboard/page.tsx`). Each already passes the full Prisma `contract` record (which now includes `face` after Task 1's migration and Prisma client regeneration), so no call-site changes should be needed — just confirm via `npm run build` that TypeScript is satisfied at each call site.

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: clean build. If any call site errors because it selects specific contract fields without `face`, add `face: true` to that `select`/`include`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/status.ts tests/lib/status.test.ts
git commit -m "feat: derive billboard status from the most urgent of up to 2 active faces"
```

---

### Task 9: Contract creation UI (new — none exists today)

**Files:**
- Create: `src/components/billboard/ContractForm.tsx`
- Modify: `src/components/billboard/ContractPanel.tsx`
- Modify: `src/app/billboards/[id]/page.tsx`

- [ ] **Step 1: Build the contract creation form**

Create `src/components/billboard/ContractForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Client = { id: string; name: string }
type Face = 'FACE_1' | 'FACE_2' | 'BOTH'

export function ContractForm({
  open,
  onOpenChange,
  billboardId,
  sides,
  availableFaces,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  billboardId: string
  sides: number
  /** Faces still free to contract on this billboard, e.g. ['FACE_2'] or ['BOTH']. */
  availableFaces: Face[]
}) {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [face, setFace] = useState<Face>(availableFaces[0] ?? 'BOTH')
  const [amount, setAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState('6')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClients = async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
    if (res.ok) setClients(await res.json())
  }

  const submit = async () => {
    if (!clientId || !amount) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billboardId,
          clientId,
          face: sides === 2 ? face : 'BOTH',
          startDate: new Date().toISOString(),
          amount: Number(amount),
          durationMonths: Number(durationMonths),
        }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      onOpenChange(false)
      router.refresh()
    } catch {
      setError('Erreur lors de la création du contrat')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) loadClients('') }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Client</Label>
            <Input placeholder="Rechercher un client…" onChange={(e) => loadClients(e.target.value)} />
            <Select value={clientId} onValueChange={(v: string | null) => v && setClientId(v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {sides === 2 && (
            <div className="space-y-1">
              <Label>Face</Label>
              <Select value={face} onValueChange={(v: string | null) => v && setFace(v as Face)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableFaces.includes('FACE_1') && <SelectItem value="FACE_1">Face 1</SelectItem>}
                  {availableFaces.includes('FACE_2') && <SelectItem value="FACE_2">Face 2</SelectItem>}
                  {availableFaces.includes('BOTH') && <SelectItem value="BOTH">Les deux faces</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Montant (MGA)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Durée (mois)</Label>
            <Input type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !clientId || !amount}>
            {submitting ? 'Création…' : 'Créer le contrat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update `ContractPanel` to accept multiple contracts and offer "Nouveau contrat"**

Replace `src/components/billboard/ContractPanel.tsx` entirely:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContractForm } from '@/components/billboard/ContractForm'

export type ContractPanelContract = {
  id: string
  client: { name: string }
  startDate: Date
  endDate: Date
  amount: number
  status: string
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

const FACE_LABELS: Record<ContractPanelContract['face'], string> = {
  FACE_1: 'Face 1',
  FACE_2: 'Face 2',
  BOTH: 'Faces 1 et 2',
}

function ContractCard({ contract }: { contract: ContractPanelContract }) {
  const router = useRouter()
  const [terminating, setTerminating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminate = async () => {
    setTerminating(true)
    setError(null)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'TERMINATED' }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      router.refresh()
    } catch {
      setError('Erreur lors de la résiliation du contrat')
    } finally {
      setTerminating(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[contract.face]}</p>
      <p className="font-medium">{contract.client.name}</p>
      <p className="text-sm text-slate-600">
        {contract.startDate.toLocaleDateString('fr-FR')} → {contract.endDate.toLocaleDateString('fr-FR')}
      </p>
      <p className="text-sm">{contract.amount} MGA</p>
      <Button variant="outline" onClick={terminate} disabled={terminating}>
        {terminating ? 'Résiliation…' : 'Terminer le contrat'}
      </Button>
    </div>
  )
}

export function ContractPanel({
  contracts,
  billboardId,
  sides,
}: {
  contracts: ContractPanelContract[]
  billboardId: string
  sides: number
}) {
  const [formOpen, setFormOpen] = useState(false)

  const occupiedFaces = contracts.map((c) => c.face)
  const availableFaces: ('FACE_1' | 'FACE_2' | 'BOTH')[] =
    occupiedFaces.includes('BOTH')
      ? []
      : sides === 1
        ? occupiedFaces.length === 0 ? ['BOTH'] : []
        : (['FACE_1', 'FACE_2'] as const).filter((f) => !occupiedFaces.includes(f))
        .concat(occupiedFaces.length === 0 ? ['BOTH'] : [])

  return (
    <div className="space-y-3">
      {contracts.length === 0 && <p className="text-sm text-slate-500">Aucun contrat en cours.</p>}
      {contracts.map((c) => <ContractCard key={c.id} contract={c} />)}
      {availableFaces.length > 0 && (
        <Button onClick={() => setFormOpen(true)}>+ Nouveau contrat</Button>
      )}
      <ContractForm
        open={formOpen}
        onOpenChange={setFormOpen}
        billboardId={billboardId}
        sides={sides}
        availableFaces={availableFaces}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update the billboard detail page to pass all active contracts**

In `src/app/billboards/[id]/page.tsx`:
- Replace `const activeContract = billboard.contracts.find((c) => c.status === 'ACTIVE')` with `const activeContracts = billboard.contracts.filter((c) => c.status === 'ACTIVE')`.
- Replace the `<ContractPanel contract={activeContract} billboardId={billboard.id} />` usage with:
```tsx
            <ContractPanel contracts={activeContracts} billboardId={billboard.id} sides={billboard.sides} />
```

- [ ] **Step 4: Manual verification**

Run `docker compose up -d db && npm run dev`, log in as ADMIN, open a 2-face billboard with no contracts:
- Verify "+ Nouveau contrat" is offered with Face 1 / Face 2 / Les deux faces all selectable.
- Create a Face 1 contract, verify only Face 2 and no longer "Les deux faces" is offered afterward.
- Create a Face 2 contract, verify no "+ Nouveau contrat" button remains (both faces occupied).
- Terminate one, verify the button reappears with only that face's option.

- [ ] **Step 5: Commit**

```bash
git add src/components/billboard/ContractForm.tsx src/components/billboard/ContractPanel.tsx src/app/billboards/[id]/page.tsx
git commit -m "feat: add contract creation UI with per-face availability on 2-face billboards"
```

---

### Task 10: History timeline face labels + multi-client table/map display

**Files:**
- Modify: `src/components/billboard/HistoryTimeline.tsx`
- Modify: `src/components/table/BillboardTable.tsx`
- Modify: `src/hooks/useBillboards.ts`
- Modify: `src/app/map/page.tsx` and `src/app/map/full/page.tsx` (drawer, if it shows client name — check `BillboardDrawer`)

- [ ] **Step 1: Add face labels to the history timeline**

In `src/components/billboard/HistoryTimeline.tsx`, add `face: 'FACE_1' | 'FACE_2' | 'BOTH'` to `HistoryTimelineContract`, and render the same `FACE_LABELS` mapping used in `ContractPanel` (move `FACE_LABELS` into `src/lib/status-labels.ts` so both components import it instead of duplicating it — add `export const FACE_LABELS = { FACE_1: 'Face 1', FACE_2: 'Face 2', BOTH: 'Faces 1 et 2' }` there, then update `ContractPanel.tsx` from Task 9 to import it instead of declaring it locally):

```tsx
import { FACE_LABELS } from '@/lib/status-labels'

export type HistoryTimelineContract = {
  id: string
  client: { name: string }
  startDate: Date
  endDate: Date
  amount: number
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

export function HistoryTimeline({ contracts }: { contracts: HistoryTimelineContract[] }) {
  if (contracts.length === 0) return <p className="text-sm text-slate-500">Aucun historique.</p>

  return (
    <ul className="space-y-3">
      {contracts.map((c) => (
        <li key={c.id} className="border-l-2 border-blue-200 pl-3">
          <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[c.face]}</p>
          <p className="font-medium">{c.client.name}</p>
          <p className="text-sm text-slate-600">
            {c.startDate.toLocaleDateString('fr-FR')} → {c.endDate.toLocaleDateString('fr-FR')} — {c.amount} MGA
          </p>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Rename "Client" to "Clients" and show up to 2 names in the table**

In `src/components/table/BillboardTable.tsx`:
- Change `activeClientName?: string` to `activeClientNames?: string[]` on `BillboardRow`.
- Change the header `<TableHead>Client</TableHead>` to `<TableHead>Clients</TableHead>`.
- Change the cell to:
```tsx
            <TableCell>{r.activeClientNames && r.activeClientNames.length > 0 ? r.activeClientNames.join(', ') : '—'}</TableCell>
```

- [ ] **Step 3: Update `useBillboards` to collect all active contracts' client names**

In `src/hooks/useBillboards.ts`:
- Change `type ApiContract = { status: string; client?: { name?: string } | null }` — no change needed to the type itself.
- In `toRow`, replace:
```ts
  const activeContract = b.contracts?.find((c) => c.status === 'ACTIVE')
```
and its use of `activeContract?.client?.name` with:
```ts
  const activeClientNames = (b.contracts ?? [])
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => c.client?.name)
    .filter((n): n is string => Boolean(n))
```
and set `activeClientNames` on the returned object instead of `activeClientName`.

- [ ] **Step 4: Check `BillboardDrawer` for the old single-name field**

Read `src/components/billboard/BillboardDrawer.tsx`. If it references `billboard.activeClientName`, update it to `billboard.activeClientNames?.join(', ')` following the same pattern.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/components/billboard/HistoryTimeline.tsx src/components/table/BillboardTable.tsx src/hooks/useBillboards.ts src/lib/status-labels.ts src/components/billboard/ContractPanel.tsx src/components/billboard/BillboardDrawer.tsx
git commit -m "feat: show face labels in history and up to 2 client names in table/map"
```

---

### Task 11: Filter by client

**Files:**
- Modify: `src/components/table/FilterBar.tsx`
- Modify: `src/app/api/billboards/where.ts`
- Test: `tests/api/billboards.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/api/billboards.test.ts` (read the file first to match its existing style/imports):

```ts
  it('filters by clientId via an active-contract relation', () => {
    const params = new URLSearchParams({ clientId: 'client-1' })
    const where = buildBillboardWhere(params)
    expect(where.contracts).toEqual({ some: { clientId: 'client-1', status: 'ACTIVE' } })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/billboards.test.ts`
Expected: FAIL — `where.contracts` is undefined.

- [ ] **Step 3: Add the filter to `buildBillboardWhere`**

In `src/app/api/billboards/where.ts`, add:
```ts
  const clientId = params.get('clientId')
  if (clientId) where.contracts = { some: { clientId, status: 'ACTIVE' } }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/billboards.test.ts`
Expected: PASS.

- [ ] **Step 5: Add a client filter dropdown to `FilterBar`**

In `src/components/table/FilterBar.tsx`:
- Add `clientId?: string` to the `Filters` type.
- Add `clients` and `useEffect` fetch of `/api/clients` (all clients, no query) on mount, storing `{ id, name }[]`.
- Add a `Select` after the "Endommagé" one:
```tsx
      <Select value={filters.clientId ?? 'all'} onValueChange={(v: string | null) => onChange({ ...filters, clientId: normalize(v) })}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Client" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les clients</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
```
This requires `FilterBar` to become responsible for its own client list — add `const [clients, setClients] = useState<{ id: string; name: string }[]>([])` and `useEffect(() => { fetch('/api/clients').then((r) => r.json()).then(setClients) }, [])` at the top of the component.

- [ ] **Step 6: Build and test check**

Run: `npm run build && npx vitest run`
Expected: clean build, all tests pass.

- [ ] **Step 7: Manual verification**

On `/database`, select a client in the new filter, verify only billboards with an active contract for that client show up.

- [ ] **Step 8: Commit**

```bash
git add src/components/table/FilterBar.tsx src/app/api/billboards/where.ts tests/api/billboards.test.ts
git commit -m "feat: filter billboards by client"
```

---

### Task 12: Add billboard via GPS coordinates and from the database view

**Files:**
- Modify: `src/components/billboard/BillboardForm.tsx`
- Modify: `src/app/database/page.tsx`

- [ ] **Step 1: Allow manual lat/lng entry in `BillboardForm`'s create mode**

In `src/components/billboard/BillboardForm.tsx`, change the `create` mode's `initialLatLng` prop to be optional and add manual override fields:
- Change the type to `initialLatLng: { lat: number; lng: number } | null` (unchanged) but add local state seeded from it: `const [lat, setLat] = useState(mode === 'create' ? props.initialLatLng?.lat?.toString() ?? '' : '')` and the equivalent for `lng`. Use a `useEffect` to update `lat`/`lng` state when `props.initialLatLng` changes (so a right-click still auto-fills the fields):
```ts
  useEffect(() => {
    if (mode === 'create' && props.initialLatLng) {
      setLat(String(props.initialLatLng.lat))
      setLng(String(props.initialLatLng.lng))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === 'create' ? props.initialLatLng : null])
```
- Change the submit guard from `if (mode === 'create' && !props.initialLatLng) return` to `if (mode === 'create' && (!lat.trim() || !lng.trim())) return`.
- Change the create request body from `{ ...props.initialLatLng, city: ..., dimension, sides }` to `{ lat: Number(lat), lng: Number(lng), city: city.trim(), dimension, sides, note: note.trim() || undefined }`.
- Add two `Input type="number"` fields for latitude/longitude in the form body (only rendered when `mode === 'create'`), before the "Ville" field:
```tsx
          {mode === 'create' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
          )}
```
- Update the submit button's `disabled` condition to also require `lat.trim() && lng.trim()` when `mode === 'create'`.
- On successful create, reset `lat`/`lng` to `''` alongside the existing `city`/`dimension`/`sides` reset.

- [ ] **Step 2: Add "+ Ajouter un panneau" to the database page**

In `src/app/database/page.tsx`, mirror the pattern already used in `src/app/map/full/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BillboardTable } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { Button } from '@/components/ui/button'
import { useBillboards } from '@/hooks/useBillboards'

export default function DatabasePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error, reload } = useBillboards(filters)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="relative flex h-[calc(100vh-56px)] flex-col">
      {error && (
        <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Chargement…</div>
        ) : (
          <BillboardTable rows={billboards} onSelect={(id) => router.push(`/billboards/${id}`)} />
        )}
      </div>
      <Button className="absolute bottom-6 right-6" onClick={() => setFormOpen(true)}>
        + Ajouter un panneau
      </Button>
      <BillboardForm mode="create" open={formOpen} onOpenChange={setFormOpen} initialLatLng={null} onSaved={reload} />
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

On `/database`, click "+ Ajouter un panneau", verify latitude/longitude fields are present and empty, fill them manually along with city/dimension, submit, verify the new billboard appears in the table and on the map at the entered coordinates.
On `/map/full`, right-click still auto-fills lat/lng as before — verify this still works (regression check for the `useEffect` added in Step 1).

- [ ] **Step 4: Commit**

```bash
git add src/components/billboard/BillboardForm.tsx src/app/database/page.tsx
git commit -m "feat: allow manual GPS entry and billboard creation from the database view"
```

---

### Task 13: Status color legend

**Files:**
- Create: `src/components/map/StatusLegend.tsx`
- Modify: `src/app/map/page.tsx`
- Modify: `src/app/map/full/page.tsx`
- Modify: `src/app/database/page.tsx`

- [ ] **Step 1: Create the legend component**

Create `src/components/map/StatusLegend.tsx`:

```tsx
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'

const ORDER: BillboardStatus[] = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-white px-4 py-2 text-xs text-slate-600">
      {ORDER.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
          {STATUS_LABELS[s]}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add it to the three pages that show status colors**

In `src/app/map/page.tsx`, `src/app/map/full/page.tsx`, and `src/app/database/page.tsx`, import `StatusLegend` and render `<StatusLegend />` as the last child inside the outer `<div className="flex h-[calc(100vh-56px)] flex-col">` (or `relative flex h-[calc(100vh-56px)] flex-col` for the two pages using that variant), i.e. after the map/table content and any absolutely-positioned buttons/dialogs.

- [ ] **Step 3: Manual verification**

Load `/map`, `/map/full`, `/database` and confirm a legend row with 5 colored dots and French labels appears at the bottom of each.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/StatusLegend.tsx src/app/map/page.tsx src/app/map/full/page.tsx src/app/database/page.tsx
git commit -m "feat: add a status color legend to map and database views"
```

---

### Task 14: Logout button + settings link in Nav

**Files:**
- Modify: `src/components/layout/Nav.tsx`

- [ ] **Step 1: Add sign-out and the city-prefixes settings link**

Replace `src/components/layout/Nav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const LINKS = [
  { href: '/map', label: 'Carte + BD' },
  { href: '/map/full', label: 'Carte' },
  { href: '/database', label: 'Base de données' },
  { href: '/clients', label: 'Clients' },
  { href: '/dashboard', label: 'Dashboard' },
]

export function Nav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  if (pathname === '/login') return null

  const isAdmin = status === 'authenticated' && session?.user?.role !== 'USER'

  return (
    <nav className="flex h-14 items-center justify-between gap-6 border-b bg-blue-900 px-4 text-white shadow-sm">
      <div className="flex items-center gap-6">
        <span className="font-semibold tracking-tight">RNA</span>
        <div className="flex items-center gap-4">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(`${l.href}/`)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm transition-colors ${
                  active ? 'font-semibold text-white underline underline-offset-4' : 'text-blue-100 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              href="/settings/city-prefixes"
              className={`text-sm transition-colors ${
                pathname?.startsWith('/settings') ? 'font-semibold text-white underline underline-offset-4' : 'text-blue-100 hover:text-white'
              }`}
            >
              Réglages
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-sm text-blue-100 transition-colors hover:text-white"
      >
        Déconnexion
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: Manual verification**

Log in, confirm "Déconnexion" appears top-right and clicking it lands back on `/login` and clears the session (reloading `/map` redirects to `/login`). Confirm "Réglages" only appears for ADMIN/DEV.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Nav.tsx
git commit -m "feat: add logout button and settings link to Nav"
```

---

## Final verification (run once all tasks are complete)

```bash
npm run build
npx vitest run
docker compose up -d --build
docker compose exec app npx prisma db seed
```

Then manually walk through, in the running app:
1. Create a 2-face billboard from `/database` using manual GPS entry.
2. Add a note to it.
3. Create a FACE_1 contract for one client, a FACE_2 contract for a different client — confirm both show on the detail page and both client names appear in the table row.
4. Filter `/database` by one of those two clients — confirm only that billboard shows.
5. Terminate one contract, confirm the billboard's status/color updates to reflect the remaining active face.
6. Delete a client with no contracts (ADMIN) — confirm the type-to-confirm flow. Try deleting one with contracts — confirm it's blocked.
7. Log in as USER, delete a client — confirm it lands in the ADMIN approval queue with the client's name shown.
8. Check the legend appears on `/map`, `/map/full`, `/database`.
9. Click "Déconnexion" — confirm it logs out.
10. Visit `/settings/city-prefixes` as ADMIN — confirm the seeded list appears, including the two flagged collisions (Ambositra, Fenerive Est) — resolve them with the client during review.
