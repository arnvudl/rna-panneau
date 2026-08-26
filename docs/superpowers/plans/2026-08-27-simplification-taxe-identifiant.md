# Simplification (retrait argent), taxe communale, identifiant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the app from "contract/money management" to pure "billboard park management": replace the `Contract` model (amount, dates, status) with a lightweight `Occupancy` model (client + face + a free-text reference to the physical PDF/docx contract living on the admin's computer + an optional end date), remove all money display everywhere, fix the billboard identifier format (drop the hardcoded "ANM" prefix — it collides with Antalaha's real airport code), add `permitNumber` and `taxPaymentRef` fields to billboards, make GPS coordinates and client info editable after creation, add a city filter, and rename "Référence" to "Identifiant" in the UI.

**Architecture:** Additive-and-subtractive Prisma schema change on the existing branch (built on top of the already-merged V2 multi-face-contracts work): `Contract` → `Occupancy` (same face-occupancy-per-billboard shape, money and mandatory dates removed), plus two new nullable `Billboard` string fields. The identifier (`Billboard.reference`, relabeled "Identifiant" in the UI) was already server-generated and never accepted as user input in any create/edit form — this plan doesn't need to add new immutability logic, only fix the generator's format and re-run it once over existing rows via a one-off script.

**Tech Stack:** Same as before — Next.js App Router, Prisma 7 + PrismaPg adapter, Zod, Tailwind/shadcn, Vitest.

---

## Context you need before starting

- This plan builds on the already-merged V2 work (multi-face contracts, client CRUD, city-prefix table, status override). Read `src/lib/status.ts`, `src/lib/contract-occupancy.ts`, and `prisma/schema.prisma` as they exist now before starting Task 1 — they're the base this plan modifies.
- **No production data exists yet** — this is still pre-launch/dev-stage (Docker + seed data only), so destructive schema changes (dropping `Contract`, dropping columns) are safe, same as prior migrations on this project.
- The billboard identifier (`reference` field, DB column name unchanged, UI label changes to "Identifiant") was **already never editable** by any role in any existing form — `createSchema` in `src/app/api/billboards/route.ts` never accepts it as input (always server-generated via `generateReference`), and `patchSchema` in `src/app/api/billboards/[id]/route.ts` never includes it either. So "make the identifier immutable" requires no new code — only the rename and the format fix below.
- The physical contract document is a PDF/docx that lives on the admin's own computer, outside this app. The app never stores or uploads that file — `Occupancy.contractRef` is just a free-text label (e.g. a filename) so the admin can find it. Same idea for `Billboard.taxPaymentRef` (municipal tax payment receipt) — null means "not paid yet / no receipt on file".
- Multi-photo upload/removal is explicitly **out of scope** for this plan — it's a separate, later chantier the user agreed to defer.

---

### Task 1: Schema migration — Occupancy replaces Contract, new Billboard fields

**Files:**
- Modify: `prisma/schema.prisma`

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

enum OccupancyStatus {
  ACTIVE
  TERMINATED
}

enum OccupancyFace {
  FACE_1
  FACE_2
  BOTH
}

enum BillboardStatus {
  AVAILABLE
  RENTED
  EXPIRING_SOON
  EXPIRED
  MAINTENANCE
}

enum ApprovalType {
  CREATE_OCCUPANCY
  EDIT_OCCUPANCY
  DELETE_BILLBOARD
  DELETE_CLIENT
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
  permitNumber    String?
  taxPaymentRef   String?
  statusOverride  BillboardStatus?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  occupancies        Occupancy[]
  maintenanceRecords MaintenanceRecord[]
}

model Client {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  email     String?
  createdAt DateTime @default(now())

  occupancies Occupancy[]
}

model Occupancy {
  id          String          @id @default(cuid())
  billboardId String
  clientId    String
  face        OccupancyFace   @default(BOTH)
  contractRef String?
  startDate   DateTime        @default(now())
  endDate     DateTime?
  status      OccupancyStatus @default(ACTIVE)
  createdAt   DateTime        @default(now())

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

Changes from the current schema: `Contract`/`ContractStatus`/`ContractFace` are gone, replaced by `Occupancy`/`OccupancyStatus`/`OccupancyFace` (same shape minus `amount`, `endDate` now nullable, `status` now only `ACTIVE`/`TERMINATED` since nothing in the app ever wrote `EXPIRED` onto the status field — the derived "Expiré" status shown in the UI has always come from comparing `endDate` to today, not from this field). `ApprovalType.EDIT_PRICE` is removed (it had no producer anywhere in the codebase). `Billboard` gains `permitNumber` and `taxPaymentRef`.

- [ ] **Step 2: Generate the migration**

Run: `docker compose up -d db && npx prisma migrate dev --name occupancy_replaces_contract`
Expected: migration created and applied. This drops the `Contract` table and the old enums — confirm there's no real data first if you want to be safe (`docker compose exec db psql -U rna -d rna_panneaux -c "select count(*) from \"Contract\";"`), but per the project's current stage this is only ever seed/test data.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: clean generation (the build will fail until later tasks update every file that references the old `Contract` model — that's expected and fixed by Tasks 3-9, not this one).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): replace Contract with Occupancy (no money), add permitNumber/taxPaymentRef"
```

---

### Task 2: Fix the identifier format and migrate existing billboards

**Files:**
- Modify: `src/lib/reference.ts`
- Modify: `tests/lib/reference.test.ts`
- Create: `scripts/rewrite-billboard-references.ts`

- [ ] **Step 1: Update the failing tests first**

Replace `tests/lib/reference.test.ts` with:

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
  it('pads sequence to 3 digits and uses the resolved prefix, prefix first', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo', prefixes: [{ city: 'Antananarivo', prefix: 'TNR' }] })).toBe(
      'TNR 001'
    )
  })

  it('does not pad sequences over 999', () => {
    expect(generateReference({ sequence: 1200, city: 'Diego', prefixes: [{ city: 'Diego', prefix: 'DIE' }] })).toBe(
      'DIE 1200'
    )
  })

  it('never contains the old hardcoded ANM prefix for a city whose real prefix differs', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo', prefixes: [{ city: 'Antananarivo', prefix: 'TNR' }] })).not.toContain(
      'ANM'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/reference.test.ts`
Expected: FAIL — current output is `'ANM 001 TNR'`, not `'TNR 001'`.

- [ ] **Step 3: Fix `generateReference`**

Replace `src/lib/reference.ts` with:

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
  return `${resolveCityPrefix(city, prefixes)} ${padded}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/reference.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the one-time migration script for existing billboards**

Create `scripts/rewrite-billboard-references.ts`:

```ts
// One-time script: recalculates every existing billboard's identifier using
// the new "{prefix} {sequence}" format (no more hardcoded "ANM"). Run once
// after Task 1's migration is applied: `npx tsx scripts/rewrite-billboard-references.ts`
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { generateReference } from '@/lib/reference'

async function main() {
  const [billboards, prefixes] = await Promise.all([
    prisma.billboard.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.cityPrefix.findMany(),
  ])

  const seqByCity = new Map<string, number>()
  let renamed = 0

  for (const b of billboards) {
    const seq = (seqByCity.get(b.city) ?? 0) + 1
    seqByCity.set(b.city, seq)
    const newReference = generateReference({ sequence: seq, city: b.city, prefixes })
    if (newReference !== b.reference) {
      await prisma.billboard.update({ where: { id: b.id }, data: { reference: newReference } })
      console.log(`${b.reference} -> ${newReference}`)
      renamed++
    }
  }

  console.log(`Done. ${renamed}/${billboards.length} billboard(s) renamed.`)
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 6: Run the script against the dev database**

Run: `docker compose up -d db && npx tsx scripts/rewrite-billboard-references.ts`
Expected: a line printed per renamed billboard (e.g. `ANM 001 TNR -> TNR 001`), ending with a `Done. N/N renamed.` summary. Re-running it immediately after should print `Done. 0/N renamed.` (idempotent — already in the new format).

- [ ] **Step 7: Commit**

```bash
git add src/lib/reference.ts tests/lib/reference.test.ts scripts/rewrite-billboard-references.ts
git commit -m "fix: drop hardcoded ANM prefix from billboard identifiers, migrate existing rows"
```

---

### Task 3: Face-occupancy library rename + status derivation for optional end dates

**Files:**
- Modify: `src/lib/contract-occupancy.ts` → rename to `src/lib/face-occupancy.ts`
- Modify: `src/lib/status.ts`
- Modify: `tests/lib/contract-occupancy.test.ts` → rename to `tests/lib/face-occupancy.test.ts`
- Modify: `tests/lib/status.test.ts`

- [ ] **Step 1: Rename and update the occupancy-availability lib**

Delete `src/lib/contract-occupancy.ts`, create `src/lib/face-occupancy.ts`:

```ts
export type OccupancyFace = 'FACE_1' | 'FACE_2' | 'BOTH'

/** True if `requestedFace` does not overlap any already-active face. */
export function isFaceAvailable(
  requestedFace: OccupancyFace,
  activeOccupancies: { face: OccupancyFace }[]
): boolean {
  if (activeOccupancies.some((o) => o.face === 'BOTH')) return false
  if (requestedFace === 'BOTH') return activeOccupancies.length === 0
  return !activeOccupancies.some((o) => o.face === requestedFace)
}
```

- [ ] **Step 2: Rename and update its test**

Delete `tests/lib/contract-occupancy.test.ts`, create `tests/lib/face-occupancy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isFaceAvailable } from '@/lib/face-occupancy'

describe('isFaceAvailable', () => {
  it('allows BOTH when no active occupancies exist', () => {
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

Run: `npx vitest run tests/lib/face-occupancy.test.ts` — Expected PASS (5 tests).

- [ ] **Step 3: Write the new failing tests for optional end dates in `deriveBillboardStatus`**

Replace `tests/lib/status.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { deriveBillboardStatus } from '@/lib/status'

const activeOccupancy = (daysUntilEnd: number | null) => ({
  status: 'ACTIVE' as const,
  endDate: daysUntilEnd === null ? null : new Date(Date.now() + daysUntilEnd * 24 * 60 * 60 * 1000),
  face: 'FACE_1' as const,
})

describe('deriveBillboardStatus', () => {
  it('returns MAINTENANCE when the billboard is flagged damaged', () => {
    expect(deriveBillboardStatus({ damaged: true, statusOverride: null, occupancies: [] })).toBe('MAINTENANCE')
  })

  it('returns AVAILABLE when there is no active occupancy', () => {
    expect(deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [] })).toBe('AVAILABLE')
  })

  it('returns RENTED when the active occupancy ends in more than 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(60)] })
    ).toBe('RENTED')
  })

  it('returns EXPIRING_SOON when the active occupancy ends within 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(10)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRING_SOON at the exact 30-day boundary', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(30)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRED when the active occupancy end date is in the past', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(-5)] })
    ).toBe('EXPIRED')
  })

  it('returns RENTED indefinitely when the active occupancy has no end date', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(null)] })
    ).toBe('RENTED')
  })

  it('returns the most urgent status across two active faces', () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const later = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000)
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      occupancies: [
        { status: 'ACTIVE', endDate: soon, face: 'FACE_1' },
        { status: 'ACTIVE', endDate: later, face: 'FACE_2' },
      ],
    })
    expect(status).toBe('EXPIRING_SOON')
  })

  it('is AVAILABLE only when no face has an active occupancy', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      occupancies: [{ status: 'TERMINATED', endDate: new Date(), face: 'FACE_1' }],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('returns the override verbatim when set, ignoring occupancies', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: 'RENTED',
      occupancies: [],
    })
    expect(status).toBe('RENTED')
  })

  it('returns the override even when damaged is true', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: 'AVAILABLE',
      occupancies: [],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('falls back to automatic derivation when override is null', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: null,
      occupancies: [],
    })
    expect(status).toBe('MAINTENANCE')
  })
})
```

- [ ] **Step 4: Run tests to verify the new ones fail**

Run: `npx vitest run tests/lib/status.test.ts`
Expected: FAIL — TypeScript error (`occupancies` isn't a recognized parameter yet, `endDate` typed as `Date`, not `Date | null`).

- [ ] **Step 5: Rewrite `src/lib/status.ts`**

```ts
export type BillboardStatus =
  | 'AVAILABLE'
  | 'RENTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'MAINTENANCE'

const EXPIRING_SOON_WINDOW_DAYS = 30
// Most urgent first: an EXPIRED face outranks a RENTED one on the same billboard.
const STATUS_PRIORITY: Array<'EXPIRED' | 'EXPIRING_SOON' | 'RENTED'> = [
  'EXPIRED',
  'EXPIRING_SOON',
  'RENTED',
]

// `endDate` is informative only (no money/contract logic depends on it). A
// face with no end date is treated as rented indefinitely — it can never
// become EXPIRING_SOON or EXPIRED on its own; only a manual statusOverride or
// terminating the occupancy changes that.
function faceStatus(endDate: Date | null): 'EXPIRED' | 'EXPIRING_SOON' | 'RENTED' {
  if (endDate === null) return 'RENTED'
  const daysUntilEnd = (endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  if (daysUntilEnd < 0) return 'EXPIRED'
  if (daysUntilEnd <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'
  return 'RENTED'
}

export function deriveBillboardStatus(billboard: {
  damaged: boolean
  statusOverride: BillboardStatus | null
  occupancies: { status: 'ACTIVE' | 'TERMINATED'; endDate: Date | null; face: 'FACE_1' | 'FACE_2' | 'BOTH' }[]
}): BillboardStatus {
  if (billboard.statusOverride) return billboard.statusOverride
  if (billboard.damaged) return 'MAINTENANCE'

  const activeOccupancies = billboard.occupancies.filter((o) => o.status === 'ACTIVE')
  if (activeOccupancies.length === 0) return 'AVAILABLE'

  const statuses = activeOccupancies.map((o) => faceStatus(o.endDate))
  return STATUS_PRIORITY.find((s) => statuses.includes(s)) ?? 'AVAILABLE'
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/lib/status.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/face-occupancy.ts src/lib/contract-occupancy.ts src/lib/status.ts tests/lib/face-occupancy.test.ts tests/lib/contract-occupancy.test.ts tests/lib/status.test.ts
git commit -m "refactor: rename contract-occupancy to face-occupancy, support optional occupancy end dates"
```

(`git add` on the deleted `src/lib/contract-occupancy.ts` and `tests/lib/contract-occupancy.test.ts` paths stages their removal.)

---

### Task 4: Occupancy API routes (replace the contracts routes)

**Files:**
- Create: `src/app/api/occupancies/route.ts`
- Create: `src/app/api/occupancies/[id]/route.ts`
- Delete: `src/app/api/contracts/route.ts`, `src/app/api/contracts/[id]/route.ts`

- [ ] **Step 1: Create the occupancy creation route**

Create `src/app/api/occupancies/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { isFaceAvailable } from '@/lib/face-occupancy'

const createSchema = z.object({
  billboardId: z.string(),
  clientId: z.string(),
  face: z.enum(['FACE_1', 'FACE_2', 'BOTH']).default('BOTH'),
  contractRef: z.string().trim().max(200).optional(),
  endDate: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  if (session.user.role === 'USER') {
    // Contract for the approvals API: CREATE_OCCUPANCY payload is always
    // shaped as { billboardId: string, clientId: string, face: 'FACE_1' |
    // 'FACE_2' | 'BOTH', contractRef?: string, endDate?: string (ISO) }.
    return createApprovalRequest(session, 'CREATE_OCCUPANCY', body)
  }

  const activeOccupancies = await prisma.occupancy.findMany({
    where: { billboardId: body.billboardId, status: 'ACTIVE' },
    select: { face: true },
  })
  if (!isFaceAvailable(body.face, activeOccupancies)) {
    return NextResponse.json({ error: 'Cette face du panneau est déjà occupée' }, { status: 409 })
  }

  const occupancy = await prisma.occupancy.create({
    data: {
      billboardId: body.billboardId,
      clientId: body.clientId,
      face: body.face,
      contractRef: body.contractRef,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    },
  })
  return NextResponse.json(occupancy, { status: 201 })
}
```

- [ ] **Step 2: Create the occupancy edit/terminate route**

Create `src/app/api/occupancies/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'TERMINATED']).optional(),
  endDate: z.string().datetime().nullable().optional(),
  contractRef: z.string().trim().max(200).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  const data = { ...body, endDate: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null }

  if (session.user.role === 'USER') {
    // Contract for the approvals API: EDIT_OCCUPANCY payload is always shaped
    // as { occupancyId: string, status?: 'ACTIVE'|'TERMINATED', endDate?:
    // string (ISO) | null, contractRef?: string | null } — only the fields
    // the caller actually sent are included alongside occupancyId.
    return createApprovalRequest(session, 'EDIT_OCCUPANCY', { occupancyId: params.id, ...body })
  }

  const occupancy = await prisma.occupancy.update({ where: { id: params.id }, data })
  return NextResponse.json(occupancy)
}
```

- [ ] **Step 3: Delete the old contracts routes**

```bash
rm -rf src/app/api/contracts
```

- [ ] **Step 4: Build check (expected to still fail — fixed by later tasks)**

Run: `npx tsc --noEmit`
Expected: errors in `ContractForm.tsx`, `ContractPanel.tsx`, `HistoryTimeline.tsx`, `src/app/api/approvals/[id]/route.ts`, `src/app/api/approvals/route.ts`, `src/app/api/clients/[id]/route.ts`, `src/app/billboards/[id]/page.tsx`, `src/app/clients/[id]/page.tsx`, `src/app/api/billboards/route.ts`, `src/app/api/billboards/[id]/route.ts`, `src/app/api/billboards/where.ts`, `src/hooks/useBillboards.ts`, `src/app/dashboard/page.tsx`, `src/components/billboard/BillboardPdfDocument.tsx`, `src/app/api/billboards/[id]/pdf/route.ts`, `tests/api/billboards.test.ts` — all fixed in Tasks 5-9 below. This is expected mid-plan breakage, not a mistake.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/occupancies src/app/api/contracts
git commit -m "feat: add occupancy API routes (create/terminate), remove contract routes"
```

---

### Task 5: Approvals API — rename CREATE_CONTRACT/EDIT_CONTRACT, drop EDIT_PRICE, occupancy count for client delete

**Files:**
- Modify: `src/app/api/approvals/[id]/route.ts`
- Modify: `src/app/api/approvals/route.ts`

- [ ] **Step 1: Rewrite `applyApproval` in `src/app/api/approvals/[id]/route.ts`**

Replace the whole file:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, type ApprovalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'
import { isFaceAvailable } from '@/lib/face-occupancy'

const patchSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const { decision } = parsed.data

  const approval = await prisma.approvalRequest.findUnique({ where: { id: params.id } })
  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (decision === 'APPROVED') {
        await applyApproval(tx, approval.type, approval.payload)
      }
      return tx.approvalRequest.update({
        where: { id: params.id },
        data: { status: decision, reviewedById: session.user.id, reviewedAt: new Date() },
      })
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Could not apply approval', code: err.code },
        { status: 400 }
      )
    }
    throw err
  }
}

async function applyApproval(
  tx: Prisma.TransactionClient,
  type: ApprovalType,
  payload: Prisma.JsonValue
) {
  const data = payload as Record<string, unknown>
  switch (type) {
    case 'CREATE_OCCUPANCY': {
      // Plain Error (not a Prisma error) deliberately bypasses the
      // PrismaClientKnownRequestError branch below and surfaces as a 500,
      // leaving this approval PENDING (transaction rolls back) instead of a
      // clean 400 — accepted tradeoff for the rare stale-approval case where
      // the requested face was taken by another occupancy after the request
      // was submitted but before admin review.
      const face = (data.face as 'FACE_1' | 'FACE_2' | 'BOTH') ?? 'BOTH'
      const activeOccupancies = await tx.occupancy.findMany({
        where: { billboardId: data.billboardId as string, status: 'ACTIVE' },
        select: { face: true },
      })
      if (!isFaceAvailable(face, activeOccupancies)) {
        throw new Error('Face already occupied')
      }
      await tx.occupancy.create({
        data: {
          billboardId: data.billboardId as string,
          clientId: data.clientId as string,
          face,
          contractRef: data.contractRef as string | undefined,
          endDate: data.endDate ? new Date(data.endDate as string) : undefined,
        },
      })
      break
    }
    case 'EDIT_OCCUPANCY':
      await tx.occupancy.update({
        where: { id: data.occupancyId as string },
        data: {
          status: data.status as 'ACTIVE' | 'TERMINATED' | undefined,
          endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate as string) : null,
          contractRef: data.contractRef as string | null | undefined,
        },
      })
      break
    case 'DELETE_BILLBOARD':
      await tx.billboard.delete({ where: { id: data.billboardId as string } })
      break
    case 'DELETE_CLIENT': {
      // Plain Error (not a Prisma error) deliberately bypasses the
      // PrismaClientKnownRequestError branch below and surfaces as a 500,
      // leaving this approval PENDING (transaction rolls back) instead of a
      // clean 400 — accepted tradeoff for the rare stale-approval case where
      // occupancies were added after the request but before admin review.
      const occupancyCount = await tx.occupancy.count({ where: { clientId: data.clientId as string } })
      if (occupancyCount > 0) {
        throw new Error('Client has associated occupancies, cannot delete')
      }
      await tx.client.delete({ where: { id: data.clientId as string } })
      break
    }
    default: {
      const _exhaustive: never = type
      throw new Error(`Unhandled ApprovalType: ${_exhaustive}`)
    }
  }
}
```

- [ ] **Step 2: Update `attachResolvedNames` in `src/app/api/approvals/route.ts`**

Replace the whole file:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requests = await prisma.approvalRequest.findMany({
    where: { status: 'PENDING' },
    include: { requestedBy: true },
    orderBy: { createdAt: 'asc' },
  })

  const enriched = await attachResolvedNames(requests)
  return NextResponse.json(enriched)
}

async function attachResolvedNames<
  T extends { payload: unknown }
>(requests: T[]) {
  const billboardIds = new Set<string>()
  const clientIds = new Set<string>()
  const occupancyIds = new Set<string>()

  for (const r of requests) {
    const data = (r.payload ?? {}) as Record<string, unknown>
    if (typeof data.billboardId === 'string') billboardIds.add(data.billboardId)
    if (typeof data.clientId === 'string') clientIds.add(data.clientId)
    if (typeof data.occupancyId === 'string') occupancyIds.add(data.occupancyId)
  }

  const [billboards, clients, occupancies] = await Promise.all([
    billboardIds.size
      ? prisma.billboard.findMany({
          where: { id: { in: Array.from(billboardIds) } },
          select: { id: true, reference: true },
        })
      : Promise.resolve([]),
    clientIds.size
      ? prisma.client.findMany({
          where: { id: { in: Array.from(clientIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    occupancyIds.size
      ? prisma.occupancy.findMany({
          where: { id: { in: Array.from(occupancyIds) } },
          select: {
            id: true,
            billboard: { select: { reference: true } },
            client: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const billboardMap = new Map(billboards.map((b) => [b.id, b.reference]))
  const clientMap = new Map(clients.map((c) => [c.id, c.name]))
  const occupancyMap = new Map(
    occupancies.map((o) => [o.id, `${o.billboard.reference} — ${o.client.name}`])
  )

  return requests.map((r) => {
    const data = (r.payload ?? {}) as Record<string, unknown>
    const resolvedNames: Record<string, string> = {}
    if (typeof data.billboardId === 'string') {
      const name = billboardMap.get(data.billboardId)
      if (name) resolvedNames.billboardId = name
    }
    if (typeof data.clientId === 'string') {
      const name = clientMap.get(data.clientId)
      if (name) resolvedNames.clientId = name
    }
    if (typeof data.occupancyId === 'string') {
      const name = occupancyMap.get(data.occupancyId)
      if (name) resolvedNames.occupancyId = name
    }
    return { ...r, resolvedNames }
  })
}
```

- [ ] **Step 3: Update the approval queue's payload labels**

In `src/components/approvals/ApprovalQueue.tsx`, replace the `PAYLOAD_LABELS` map:

```ts
const PAYLOAD_LABELS: Record<string, string> = {
  billboardId: 'Panneau',
  clientId: 'Client',
  occupancyId: 'Contrat',
  face: 'Face',
  contractRef: 'Référence du contrat',
  startDate: 'Début',
  endDate: 'Fin',
  status: 'Statut',
}
```

(Removed `amount`, renamed `contractId` → `occupancyId`, added `face`/`contractRef`. `contractId`/`Contrat` label kept in spirit — "Contrat" is still the right human word for what an `Occupancy` represents, even though the underlying model is renamed for code clarity.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/approvals src/components/approvals/ApprovalQueue.tsx
git commit -m "feat: rename approval types to CREATE_OCCUPANCY/EDIT_OCCUPANCY, drop EDIT_PRICE"
```

---

### Task 6: Occupancy UI components (rename ContractForm/ContractPanel, strip money)

**Files:**
- Create: `src/components/billboard/OccupancyForm.tsx` (replaces `ContractForm.tsx`)
- Create: `src/components/billboard/OccupancyPanel.tsx` (replaces `ContractPanel.tsx`)
- Modify: `src/components/billboard/HistoryTimeline.tsx`
- Delete: `src/components/billboard/ContractForm.tsx`, `src/components/billboard/ContractPanel.tsx`

- [ ] **Step 1: Create `OccupancyForm.tsx`**

Create `src/components/billboard/OccupancyForm.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Client = { id: string; name: string }
type Face = 'FACE_1' | 'FACE_2' | 'BOTH'

const FACE_SELECT_LABELS: Record<Face, string> = {
  FACE_1: 'Face 1',
  FACE_2: 'Face 2',
  BOTH: 'Les deux faces',
}

export function OccupancyForm({
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
  /** Faces still free to occupy on this billboard, e.g. ['FACE_2'] or ['BOTH']. */
  availableFaces: Face[]
}) {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [face, setFace] = useState<Face>(availableFaces[0] ?? 'BOTH')
  const [contractRef, setContractRef] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClients = async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
    if (res.ok) setClients(await res.json())
  }

  // The dialog's `open` prop is set by the parent (OccupancyPanel), not by
  // user interaction with the Dialog itself, so Dialog's onOpenChange never
  // fires for that transition. Load the initial client list here instead.
  // This also resets all fields: OccupancyForm stays mounted across creations
  // (only `open` toggles), so without this, stale values would silently
  // carry over into the next occupancy creation.
  useEffect(() => {
    if (open) {
      loadClients('')
      setFace(availableFaces[0] ?? 'BOTH')
      setClientId('')
      setContractRef('')
      setEndDate('')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async () => {
    if (!clientId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/occupancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billboardId,
          clientId,
          face: sides === 2 ? face : 'BOTH',
          contractRef: contractRef.trim() || undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`)
      }
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du contrat')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Client</Label>
            <Input placeholder="Rechercher un client…" onChange={(e) => loadClients(e.target.value)} />
            <Select
              items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
              value={clientId}
              onValueChange={(v: string | null) => v && setClientId(v)}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {sides === 2 && (
            <div className="space-y-1">
              <Label>Face</Label>
              <Select
                items={Object.fromEntries(availableFaces.map((f) => [f, FACE_SELECT_LABELS[f]]))}
                value={face}
                onValueChange={(v: string | null) => v && setFace(v as Face)}
              >
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
            <Label>Référence du contrat (optionnel)</Label>
            <Input
              placeholder="ex: Contrat-2026-014.pdf"
              value={contractRef}
              onChange={(e) => setContractRef(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Le contrat lui-même reste sur l&apos;ordinateur de l&apos;admin — cette référence sert juste à le retrouver.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Date de fin (optionnel)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !clientId}>
            {submitting ? 'Création…' : 'Créer le contrat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `OccupancyPanel.tsx`**

Create `src/components/billboard/OccupancyPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OccupancyForm } from '@/components/billboard/OccupancyForm'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { FACE_LABELS } from '@/lib/status-labels'

export type OccupancyPanelOccupancy = {
  id: string
  client: { name: string }
  contractRef: string | null
  endDate: Date | null
  status: string
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

function OccupancyCard({ occupancy }: { occupancy: OccupancyPanelOccupancy }) {
  const router = useRouter()
  const [terminating, setTerminating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminate = async () => {
    setTerminating(true)
    setError(null)
    try {
      const res = await fetch(`/api/occupancies/${occupancy.id}`, {
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
      <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[occupancy.face]}</p>
      <p className="font-medium">{occupancy.client.name}</p>
      {occupancy.contractRef && <p className="text-sm text-slate-600">Contrat : {occupancy.contractRef}</p>}
      <p className="text-sm text-slate-600">
        {occupancy.endDate ? `Jusqu'au ${occupancy.endDate.toLocaleDateString('fr-FR')}` : 'Durée indéterminée'}
      </p>
      <Button variant="outline" onClick={terminate} disabled={terminating}>
        {terminating ? 'Résiliation…' : 'Terminer le contrat'}
      </Button>
    </div>
  )
}

export function OccupancyPanel({
  occupancies,
  billboardId,
  sides,
}: {
  occupancies: OccupancyPanelOccupancy[]
  billboardId: string
  sides: number
}) {
  const [formOpen, setFormOpen] = useState(false)

  const activeFaces = occupancies.map((o) => ({ face: o.face }))
  const availableFaces: ('FACE_1' | 'FACE_2' | 'BOTH')[] =
    sides === 1
      ? isFaceAvailable('BOTH', activeFaces) ? ['BOTH'] : []
      : (['FACE_1', 'FACE_2', 'BOTH'] as const).filter((f) => isFaceAvailable(f, activeFaces))

  return (
    <div className="space-y-3">
      {occupancies.length === 0 && <p className="text-sm text-slate-500">Aucun contrat en cours.</p>}
      {occupancies.map((o) => <OccupancyCard key={o.id} occupancy={o} />)}
      {availableFaces.length > 0 && (
        <Button onClick={() => setFormOpen(true)}>+ Nouveau contrat</Button>
      )}
      <OccupancyForm
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

- [ ] **Step 3: Delete the old files**

```bash
rm src/components/billboard/ContractForm.tsx src/components/billboard/ContractPanel.tsx
```

- [ ] **Step 4: Update `HistoryTimeline.tsx`**

Replace `src/components/billboard/HistoryTimeline.tsx`:

```tsx
import { FACE_LABELS } from '@/lib/status-labels'

export type HistoryTimelineOccupancy = {
  id: string
  client: { name: string }
  contractRef: string | null
  endDate: Date | null
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

export function HistoryTimeline({ occupancies }: { occupancies: HistoryTimelineOccupancy[] }) {
  if (occupancies.length === 0) return <p className="text-sm text-slate-500">Aucun historique.</p>

  return (
    <ul className="space-y-3">
      {occupancies.map((o) => (
        <li key={o.id} className="border-l-2 border-blue-200 pl-3">
          <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[o.face]}</p>
          <p className="font-medium">{o.client.name}</p>
          <p className="text-sm text-slate-600">
            {o.contractRef ? `Contrat : ${o.contractRef}` : 'Sans référence'}
            {o.endDate ? ` — jusqu'au ${o.endDate.toLocaleDateString('fr-FR')}` : ' — durée indéterminée'}
          </p>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/billboard/OccupancyForm.tsx src/components/billboard/OccupancyPanel.tsx src/components/billboard/HistoryTimeline.tsx src/components/billboard/ContractForm.tsx src/components/billboard/ContractPanel.tsx
git commit -m "feat: replace ContractForm/ContractPanel with OccupancyForm/OccupancyPanel (no money)"
```

---

### Task 7: Billboard detail page — wire occupancies, show permit/tax fields

**Files:**
- Modify: `src/app/billboards/[id]/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace `src/app/billboards/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { ImageOff } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { OccupancyPanel } from '@/components/billboard/OccupancyPanel'
import { HistoryTimeline } from '@/components/billboard/HistoryTimeline'
import { MaintenancePanel } from '@/components/billboard/MaintenancePanel'
import { ExportPdfButton } from '@/components/billboard/ExportPdfButton'
import { BillboardDetailActions } from '@/components/billboard/BillboardDetailActions'
import { StatusOverrideControl } from '@/components/billboard/StatusOverrideControl'

export default async function BillboardPage({ params }: { params: { id: string } }) {
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) notFound()

  const status = deriveBillboardStatus(billboard)
  const activeOccupancies = billboard.occupancies.filter((o) => o.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{billboard.reference}</h1>
          <p className="text-slate-600">{billboard.city} — {billboard.dimension} — {billboard.sides} face(s)</p>
          <p className="mt-1 text-sm text-slate-500">
            {billboard.lat.toFixed(5)}, {billboard.lng.toFixed(5)} — créé le {billboard.createdAt.toLocaleDateString('fr-FR')}
          </p>
          {billboard.permitNumber && <p className="mt-1 text-sm text-slate-500">Autorisation municipale : {billboard.permitNumber}</p>}
          <p className="mt-1 text-sm text-slate-500">
            Taxe communale : {billboard.taxPaymentRef ? `payée (réf. ${billboard.taxPaymentRef})` : 'non payée'}
          </p>
          {billboard.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">Note : {billboard.note}</p>}
        </div>
        <div className="flex gap-2">
          <BillboardDetailActions
            billboard={{
              id: billboard.id,
              city: billboard.city,
              dimension: billboard.dimension,
              sides: billboard.sides,
              note: billboard.note,
              lat: billboard.lat,
              lng: billboard.lng,
              permitNumber: billboard.permitNumber,
              taxPaymentRef: billboard.taxPaymentRef,
            }}
          />
          <ExportPdfButton billboardId={billboard.id} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={STATUS_BADGE_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
        <StatusOverrideControl billboardId={billboard.id} statusOverride={billboard.statusOverride} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          {billboard.currentPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={billboard.currentPhotoUrl}
              alt={billboard.reference}
              className="aspect-video w-full rounded-xl border object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-slate-50 text-slate-400">
              <ImageOff className="h-10 w-10" />
              <p className="text-sm font-medium">Aucune photo</p>
            </div>
          )}
        </div>

        <Tabs defaultValue="contract">
          <TabsList>
            <TabsTrigger value="contract">Contrat en cours</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="maintenance">Entretien</TabsTrigger>
          </TabsList>
          <TabsContent value="contract">
            <OccupancyPanel occupancies={activeOccupancies} billboardId={billboard.id} sides={billboard.sides} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTimeline occupancies={billboard.occupancies} />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: errors remain in `BillboardForm.tsx`/`BillboardDetailActions.tsx` (missing `lat`/`lng`/`permitNumber`/`taxPaymentRef` on `EditableBillboard`) — fixed in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/app/billboards/[id]/page.tsx
git commit -m "feat: wire billboard detail page to occupancies, show permit/tax info"
```

---

### Task 8: Billboard fields — permitNumber, taxPaymentRef, GPS editable after creation

**Files:**
- Modify: `src/app/api/billboards/route.ts`
- Modify: `src/app/api/billboards/[id]/route.ts`
- Modify: `src/app/api/billboards/where.ts`
- Modify: `src/components/billboard/BillboardForm.tsx`

- [ ] **Step 1: Update the billboard create route**

In `src/app/api/billboards/route.ts`, replace the whole file:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { generateReference } from '@/lib/reference'
import { buildBillboardWhere } from './where'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const where = buildBillboardWhere(req.nextUrl.searchParams)
  const billboards = await prisma.billboard.findMany({
    where,
    include: { occupancies: { where: { status: 'ACTIVE' }, include: { client: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const statusFilter = req.nextUrl.searchParams.get('status')
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))
  const filtered = statusFilter ? withStatus.filter((b) => b.status === statusFilter) : withStatus

  return NextResponse.json(filtered)
}

const createSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  city: z.string().min(1),
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']),
  sides: z.union([z.literal(1), z.literal(2)]),
  note: z.string().trim().max(2000).optional(),
  permitNumber: z.string().trim().max(100).optional(),
  taxPaymentRef: z.string().trim().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  const [count, prefixes] = await Promise.all([
    prisma.billboard.count({ where: { city: body.city } }),
    prisma.cityPrefix.findMany(),
  ])
  const reference = generateReference({ sequence: count + 1, city: body.city, prefixes })

  try {
    const billboard = await prisma.billboard.create({
      data: { ...body, reference },
    })
    return NextResponse.json(billboard, { status: 201 })
  } catch (err) {
    // Reference is unique; under concurrent requests for the same city the
    // count-then-create sequence can race and collide. At this project's
    // scale (3 users, <500 billboards) a clean error is enough — no retry loop.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Reference collision, please retry the request' },
        { status: 409 }
      )
    }
    throw err
  }
}
```

- [ ] **Step 2: Update the billboard patch route**

In `src/app/api/billboards/[id]/route.ts`, replace the whole file:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...billboard, status: deriveBillboardStatus(billboard) })
}

const patchSchema = z.object({
  damaged: z.boolean().optional(),
  currentPhotoUrl: z.string().url().optional(),
  city: z.string().trim().min(1).optional(),
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']).optional(),
  sides: z.union([z.literal(1), z.literal(2)]).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  statusOverride: z
    .enum(['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE'])
    .nullable()
    .optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  permitNumber: z.string().trim().max(100).nullable().optional(),
  taxPaymentRef: z.string().trim().max(200).nullable().optional(),
})

const RESTRICTED_FIELDS = [
  'city',
  'dimension',
  'sides',
  'statusOverride',
  'lat',
  'lng',
  'permitNumber',
  'taxPaymentRef',
] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  // USER role may only update the photo (part of "add photo" workflow) or the
  // damaged flag; editing core billboard attributes is more sensitive and
  // requires DEV/ADMIN. The identifier itself (`reference`) is never in this
  // schema at all — no role can change it once generated at creation.
  const touchesRestrictedField = RESTRICTED_FIELDS.some((field) => field in parsed.data)
  if (touchesRestrictedField && session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(billboard)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (session.user.role === 'USER') {
    // Contract for the approvals API: DELETE_BILLBOARD payload is always
    // shaped as { billboardId: string } — the id of the billboard to remove
    // once the request is approved.
    return createApprovalRequest(session, 'DELETE_BILLBOARD', { billboardId: params.id })
  }

  await prisma.billboard.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
```

- [ ] **Step 3: Update `buildBillboardWhere`'s clientId filter to use occupancies**

Replace `src/app/api/billboards/where.ts`:

```ts
import type { Prisma } from '@prisma/client'

export function buildBillboardWhere(params: URLSearchParams): Prisma.BillboardWhereInput {
  const where: Prisma.BillboardWhereInput = {}
  const city = params.get('city')
  const dimension = params.get('dimension')
  const damaged = params.get('damaged')

  if (city) where.city = city
  if (dimension) where.dimension = dimension as Prisma.BillboardWhereInput['dimension']
  if (damaged !== null) where.damaged = damaged === 'true'

  const clientId = params.get('clientId')
  if (clientId) where.occupancies = { some: { clientId, status: 'ACTIVE' } }

  return where
}
```

- [ ] **Step 4: Update the corresponding test**

In `tests/api/billboards.test.ts`, replace the `clientId` test:

```ts
  it('filters by clientId via an active-occupancy relation', () => {
    const params = new URLSearchParams({ clientId: 'client-1' })
    const where = buildBillboardWhere(params)
    expect(where.occupancies).toEqual({ some: { clientId: 'client-1', status: 'ACTIVE' } })
  })
```

Run: `npx vitest run tests/api/billboards.test.ts` — Expected PASS (4 tests).

- [ ] **Step 5: Update `BillboardForm.tsx` — GPS editable in both modes, add permitNumber/taxPaymentRef**

Replace `src/components/billboard/BillboardForm.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

export type EditableBillboard = {
  id: string
  city: string
  dimension: string
  sides: number
  note?: string | null
  lat: number
  lng: number
  permitNumber?: string | null
  taxPaymentRef?: string | null
}

type BillboardFormProps =
  | {
      mode: 'create'
      open: boolean
      onOpenChange: (open: boolean) => void
      initialLatLng: { lat: number; lng: number } | null
      onSaved: () => void
    }
  | {
      mode: 'edit'
      open: boolean
      onOpenChange: (open: boolean) => void
      billboard: EditableBillboard
      onSaved: () => void
    }

export function BillboardForm(props: BillboardFormProps) {
  const { mode, open, onOpenChange, onSaved } = props
  const initial = mode === 'edit' ? props.billboard : null

  const [city, setCity] = useState(initial?.city ?? '')
  const [dimension, setDimension] = useState(initial?.dimension ?? 'D4X3')
  const [sides, setSides] = useState<1 | 2>(initial?.sides === 2 ? 2 : 1)
  const [note, setNote] = useState(initial?.note ?? '')
  const [permitNumber, setPermitNumber] = useState(initial?.permitNumber ?? '')
  const [taxPaymentRef, setTaxPaymentRef] = useState(initial?.taxPaymentRef ?? '')
  const [lat, setLat] = useState(
    mode === 'create' ? props.initialLatLng?.lat?.toString() ?? '' : String(initial?.lat ?? '')
  )
  const [lng, setLng] = useState(
    mode === 'create' ? props.initialLatLng?.lng?.toString() ?? '' : String(initial?.lng ?? '')
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only the create flow's lat/lng need to re-sync from a changing prop (a
  // map right-click while the dialog is open); edit mode's initial value is
  // fixed for the lifetime of one dialog open, no effect needed there.
  useEffect(() => {
    if (mode === 'create' && props.initialLatLng) {
      setLat(String(props.initialLatLng.lat))
      setLng(String(props.initialLatLng.lng))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === 'create' ? props.initialLatLng : null])

  const submit = async () => {
    if (!lat.trim() || !lng.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/billboards' : `/api/billboards/${props.billboard.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const shared = {
        lat: Number(lat),
        lng: Number(lng),
        city: city.trim(),
        dimension,
        sides,
        permitNumber: permitNumber.trim() || (mode === 'edit' ? null : undefined),
        taxPaymentRef: taxPaymentRef.trim() || (mode === 'edit' ? null : undefined),
      }
      const body =
        mode === 'create'
          ? { ...shared, note: note.trim() || undefined }
          : { ...shared, note: note.trim() === '' ? null : note.trim() }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)

      if (mode === 'create') {
        setCity('')
        setDimension('D4X3')
        setSides(1)
        setLat('')
        setLng('')
        setPermitNumber('')
        setTaxPaymentRef('')
      }
      onOpenChange(false)
      onSaved()
    } catch {
      setError(mode === 'create' ? 'Erreur lors de la création du panneau' : 'Erreur lors de la modification du panneau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Ajouter un panneau' : 'Modifier le panneau'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
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
          <div className="space-y-1">
            <Label>Ville</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Dimension</Label>
            <Select
              items={Object.fromEntries(DIMENSIONS.map((d) => [d, d]))}
              value={dimension}
              onValueChange={(v: string | null) => v && setDimension(v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Faces</Label>
            <Select
              items={{ '1': '1 face', '2': '2 faces' }}
              value={String(sides)}
              onValueChange={(v: string | null) => v && setSides(Number(v) as 1 | 2)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 face</SelectItem>
                <SelectItem value="2">2 faces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Numéro d&apos;autorisation municipale (optionnel)</Label>
            <Input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Référence taxe communale payée (optionnel)</Label>
            <Input
              placeholder="Vide si pas encore payée"
              value={taxPaymentRef}
              onChange={(e) => setTaxPaymentRef(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <textarea
              className="w-full rounded-md border border-slate-200 p-2 text-sm"
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            onClick={submit}
            className="w-full"
            disabled={submitting || !city.trim() || !lat.trim() || !lng.trim()}
          >
            {submitting ? (mode === 'create' ? 'Création…' : 'Enregistrement…') : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6: Update `BillboardDetailActions`'s prop usage — no code change needed**

`src/components/billboard/BillboardDetailActions.tsx` already just forwards its `billboard: EditableBillboard` prop straight into `BillboardForm`'s `edit` mode — since `EditableBillboard` grew new fields in Step 5 and Task 7 already passes them all from the detail page, no edit is needed here. Run `npx tsc --noEmit` after this task to confirm.

- [ ] **Step 7: Fix `useBillboards.ts` — it still reads the old `contracts` key**

Step 1 renamed `GET /api/billboards`'s included relation from `contracts` to `occupancies`. `src/hooks/useBillboards.ts` reads `b.contracts` to build the map/table's client-name list — since that field is optional in its local `ApiBillboard` type, this would NOT show up as a TypeScript error (it would just silently always be `undefined`, so every billboard would wrongly show no active client anywhere in the app). Replace `src/hooks/useBillboards.ts`:

```ts
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BillboardRow } from '@/components/table/BillboardTable'
import type { Filters } from '@/components/table/FilterBar'

type ApiOccupancy = {
  status: string
  client?: { name?: string } | null
}

type ApiBillboard = {
  id: string
  reference: string
  city: string
  dimension: string
  status: string
  damaged: boolean
  lat: number
  lng: number
  note?: string | null
  occupancies?: ApiOccupancy[]
}

export type BillboardWithLatLng = BillboardRow & { lat: number; lng: number }

function toRow(b: ApiBillboard): BillboardWithLatLng {
  const activeClientNames = (b.occupancies ?? [])
    .filter((o) => o.status === 'ACTIVE')
    .map((o) => o.client?.name)
    .filter((n): n is string => Boolean(n))
  return {
    id: b.id,
    reference: b.reference,
    city: b.city,
    dimension: b.dimension,
    status: b.status,
    damaged: b.damaged,
    lat: b.lat,
    lng: b.lng,
    note: b.note,
    activeClientNames,
  }
}

export function useBillboards(filters: Filters) {
  const router = useRouter()
  const [billboards, setBillboards] = useState<BillboardWithLatLng[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) as Record<string, string>
    )
    fetch(`/api/billboards?${params}`, { signal: controller.signal })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.push('/login')
          return null
        }
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      })
      .then((data: ApiBillboard[] | null) => {
        if (data === null) return
        setBillboards(Array.isArray(data) ? data.map(toRow) : [])
        setError(null)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Erreur de chargement des panneaux')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  return { billboards, loading, error, reload }
}
```

- [ ] **Step 8: Build and test check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: remaining errors only in `HistoryTimeline`'s caller (already fixed in Task 7), `ClientForm`/`ClientDetailActions`/`clients/[id]/page.tsx` (Task 12), `dashboard/page.tsx` (Task 11), `BillboardPdfDocument.tsx`/pdf route (Task 9), `FilterBar.tsx` city control (Task 10 — this one is additive, not a type error). If any error appears outside those areas, stop and fix it before continuing.

- [ ] **Step 9: Manual verification that client names still show**

Run `docker compose up -d db && npm run dev`, open `/database` or `/map` — confirm the seeded billboard (`TNR 001` after Task 2's migration script has run, or still `ANM 001 TNR` if you haven't run it yet on this DB) shows "Orange Madagascar" in its Clients column, not a blank dash. This is the regression check for Step 7 above.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/billboards src/components/billboard/BillboardForm.tsx src/hooks/useBillboards.ts tests/api/billboards.test.ts
git commit -m "feat: make GPS editable after creation, add permitNumber/taxPaymentRef fields"
```

---

### Task 9: PDF export — remove money, use occupancies

**Files:**
- Modify: `src/components/billboard/BillboardPdfDocument.tsx`
- Modify: `src/app/api/billboards/[id]/pdf/route.ts`

- [ ] **Step 1: Update the PDF document component**

Replace `src/components/billboard/BillboardPdfDocument.tsx`:

```tsx
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 12, color: '#1e3a8a' },
  section: { marginBottom: 16 },
  label: { color: '#64748b', fontSize: 9 },
  photo: { width: '100%', height: 200, objectFit: 'cover', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
})

export type BillboardPdfData = {
  reference: string
  city: string
  dimension: string
  sides: number
  status: string
  currentPhotoUrl: string | null
  permitNumber: string | null
  taxPaymentRef: string | null
  occupancies: { clientName: string; face: string; contractRef: string | null; endDate: string | null }[]
  maintenanceRecords: { date: string; type: string; comment: string | null }[]
}

export function BillboardPdfDocument({ data }: { data: BillboardPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.reference}</Text>
        {data.currentPhotoUrl && <Image src={data.currentPhotoUrl} style={styles.photo} />}

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>Ville</Text><Text>{data.city}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Dimensions</Text><Text>{data.dimension}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Faces</Text><Text>{data.sides}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Statut</Text><Text>{data.status}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Autorisation</Text><Text>{data.permitNumber ?? '—'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Taxe communale</Text><Text>{data.taxPaymentRef ?? 'Non payée'}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Historique des contrats</Text>
          {data.occupancies.map((o, i) => (
            <View key={i} style={styles.row}>
              <Text>{o.face} — {o.clientName}</Text>
              <Text>{o.contractRef ?? 'Sans référence'}{o.endDate ? ` (jusqu'au ${o.endDate})` : ''}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Entretien</Text>
          {data.maintenanceRecords.map((m, i) => (
            <View key={i} style={styles.row}>
              <Text>{m.date} — {m.type}</Text>
              <Text>{m.comment ?? ''}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Update the PDF route**

Replace `src/app/api/billboards/[id]/pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireSession } from '@/lib/api-helpers'
import { BillboardPdfDocument } from '@/components/billboard/BillboardPdfDocument'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(
    BillboardPdfDocument({
      data: {
        reference: billboard.reference,
        city: billboard.city,
        dimension: billboard.dimension,
        sides: billboard.sides,
        status: deriveBillboardStatus(billboard),
        currentPhotoUrl: billboard.currentPhotoUrl,
        permitNumber: billboard.permitNumber,
        taxPaymentRef: billboard.taxPaymentRef,
        occupancies: billboard.occupancies.map((o) => ({
          clientName: o.client.name,
          face: o.face,
          contractRef: o.contractRef,
          endDate: o.endDate ? o.endDate.toLocaleDateString('fr-FR') : null,
        })),
        maintenanceRecords: billboard.maintenanceRecords.map((m) => ({
          date: m.date.toLocaleDateString('fr-FR'),
          type: m.type,
          comment: m.comment,
        })),
      },
    })
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${billboard.reference}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit`
Expected: no more errors in these two files.

- [ ] **Step 4: Commit**

```bash
git add src/components/billboard/BillboardPdfDocument.tsx src/app/api/billboards/[id]/pdf/route.ts
git commit -m "feat: remove money from the PDF export, show permit/tax info"
```

---

### Task 10: City filter

**Files:**
- Modify: `src/components/table/FilterBar.tsx`

The backend already supports `?city=` (see `buildBillboardWhere`, unchanged by this task) — only the UI control is missing.

- [ ] **Step 1: Add a city select to `FilterBar`, sourced from the city-prefix table**

In `src/components/table/FilterBar.tsx`, add a `cities` state fetched from the existing `/api/city-prefixes` endpoint (already built, admin-managed canonical city list), and a new `Select` for it:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_LABELS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'

export type Filters = { status?: string; city?: string; dimension?: string; damaged?: string; clientId?: string }

const STATUSES: BillboardStatus[] = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']
const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

function normalize(v: string | null): string | undefined {
  return v === 'all' || v === null ? undefined : v
}

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [cities, setCities] = useState<{ city: string; prefix: string }[]>([])

  useEffect(() => {
    fetch('/api/clients').then((r) => r.json()).then(setClients)
    fetch('/api/city-prefixes').then((r) => r.json()).then(setCities)
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-3">
      <Select
        items={{ all: 'Toutes les villes', ...Object.fromEntries(cities.map((c) => [c.city, c.city])) }}
        value={filters.city ?? 'all'}
        onValueChange={(v: string | null) => onChange({ ...filters, city: normalize(v) })}
      >
        <SelectTrigger className="w-44"><SelectValue placeholder="Ville" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les villes</SelectItem>
          {cities.map((c) => <SelectItem key={c.city} value={c.city}>{c.city}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select
        items={{ all: 'Tous les statuts', ...Object.fromEntries(STATUSES.map((s) => [s, STATUS_LABELS[s]])) }}
        value={filters.status ?? 'all'}
        onValueChange={(v: string | null) => onChange({ ...filters, status: normalize(v) })}
      >
        <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select
        items={{
          all: 'Toutes dimensions',
          ...Object.fromEntries(DIMENSIONS.map((d) => [d, d.replace('D', '').replace('X', 'x')])),
        }}
        value={filters.dimension ?? 'all'}
        onValueChange={(v: string | null) => onChange({ ...filters, dimension: normalize(v) })}
      >
        <SelectTrigger className="w-36"><SelectValue placeholder="Dimension" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes dimensions</SelectItem>
          {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d.replace('D', '').replace('X', 'x')}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select
        items={{ all: 'Tous', true: 'Endommagé', false: 'Non endommagé' }}
        value={filters.damaged ?? 'all'}
        onValueChange={(v: string | null) => onChange({ ...filters, damaged: normalize(v) })}
      >
        <SelectTrigger className="w-40"><SelectValue placeholder="Endommagé" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          <SelectItem value="true">Endommagé</SelectItem>
          <SelectItem value="false">Non endommagé</SelectItem>
        </SelectContent>
      </Select>

      <Select
        items={{ all: 'Tous les clients', ...Object.fromEntries(clients.map((c) => [c.id, c.name])) }}
        value={filters.clientId ?? 'all'}
        onValueChange={(v: string | null) => onChange({ ...filters, clientId: normalize(v) })}
      >
        <SelectTrigger className="w-48"><SelectValue placeholder="Client" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les clients</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run `docker compose up -d db && npm run dev`, open `/database`, select a city — confirm only billboards in that city show.

- [ ] **Step 3: Commit**

```bash
git add src/components/table/FilterBar.tsx
git commit -m "feat: filter billboards by city"
```

---

### Task 11: Dashboard — remove the revenue card

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the page without money**

Replace `src/app/dashboard/page.tsx`:

```tsx
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireRole } from '@/components/layout/RoleGate'
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, KeyRound, Clock3 } from 'lucide-react'

export default async function DashboardPage() {
  await requireRole(['DEV', 'ADMIN'])

  const billboards = await prisma.billboard.findMany({ include: { occupancies: true } })
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))

  const available = withStatus.filter((b) => b.status === 'AVAILABLE').length
  const rented = withStatus.filter((b) => b.status === 'RENTED' || b.status === 'EXPIRING_SOON').length
  const expiringSoon = withStatus.filter((b) => b.status === 'EXPIRING_SOON').length

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card className="overflow-hidden border-t-4 border-t-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Disponibles</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent className="text-3xl font-bold text-slate-900">{available}</CardContent>
        </Card>
        <Card className="overflow-hidden border-t-4 border-t-blue-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">En location</CardTitle>
            <KeyRound className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="text-3xl font-bold text-slate-900">{rented}</CardContent>
        </Card>
        <Card className="overflow-hidden border-t-4 border-t-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Expirent bientôt</CardTitle>
            <Clock3 className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent className="text-3xl font-bold text-slate-900">{expiringSoon}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Demandes d&apos;approbation</CardTitle></CardHeader>
        <CardContent><ApprovalQueue /></CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: remove revenue card from dashboard (no money tracked anymore)"
```

---

### Task 12: Client editing (new — none existed before)

**Files:**
- Modify: `src/app/api/clients/[id]/route.ts`
- Modify: `src/components/clients/ClientForm.tsx`
- Modify: `src/components/clients/ClientDetailActions.tsx`
- Modify: `src/app/clients/[id]/page.tsx`

- [ ] **Step 1: Add `PATCH` to the client route**

In `src/app/api/clients/[id]/route.ts`, replace the whole file:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { occupancies: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(client)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'DELETE_CLIENT', { clientId: params.id })
  }

  const occupancyCount = await prisma.occupancy.count({ where: { clientId: params.id } })
  if (occupancyCount > 0) {
    return NextResponse.json(
      { error: 'Ce client a des contrats associés (actifs ou passés) et ne peut pas être supprimé.' },
      { status: 409 }
    )
  }

  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
```

- [ ] **Step 2: Give `ClientForm` a create/edit mode, matching `BillboardForm`'s pattern**

Replace `src/components/clients/ClientForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type EditableClient = { id: string; name: string; phone: string | null; email: string | null }

type ClientFormProps =
  | { mode: 'create'; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }
  | { mode: 'edit'; client: EditableClient; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }

export function ClientForm(props: ClientFormProps) {
  const { mode, open, onOpenChange, onSaved } = props
  const initial = mode === 'edit' ? props.client : null

  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/clients' : `/api/clients/${props.client.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      if (mode === 'create') {
        setName('')
        setPhone('')
        setEmail('')
      }
      onOpenChange(false)
      onSaved()
    } catch {
      setError(mode === 'create' ? 'Erreur lors de la création du client' : 'Erreur lors de la modification du client')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === 'create' ? 'Nouveau client' : 'Modifier le client'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Nom de l&apos;entreprise</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !name.trim()}>
            {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

Note: `src/app/clients/page.tsx` calls `<ClientForm open={formOpen} onOpenChange={setFormOpen} onCreated={reload} />` — its prop is named `onCreated`, but the type above now requires `onSaved`. Update that one call site too:

In `src/app/clients/page.tsx`, change `<ClientForm open={formOpen} onOpenChange={setFormOpen} onCreated={reload} />` to `<ClientForm mode="create" open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />`.

- [ ] **Step 3: Add "Modifier" to `ClientDetailActions`**

Replace `src/components/clients/ClientDetailActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { ClientForm, type EditableClient } from '@/components/clients/ClientForm'

export function ClientDetailActions({ client }: { client: EditableClient }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const canEdit = status === 'authenticated' && session?.user?.role !== 'USER'

  // Any authenticated role may trigger deletion — the API itself routes USER
  // requests to the approval queue instead of deleting directly.
  if (status !== 'authenticated') return null

  const deleteClient = async () => {
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`)
    }
    router.push('/clients')
  }

  return (
    <div className="flex gap-2">
      {canEdit && (
        <>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Modifier
          </Button>
          <ClientForm
            mode="edit"
            client={client}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={() => router.refresh()}
          />
        </>
      )}
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        Supprimer
      </Button>
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityLabel="ce client"
        entityName={client.name}
        onConfirm={deleteClient}
      />
    </div>
  )
}
```

- [ ] **Step 4: Update the client detail page**

Replace `src/app/clients/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatContactInfo } from '@/lib/client-format'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { occupancies: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <ClientDetailActions client={{ id: client.id, name: client.name, phone: client.phone, email: client.email }} />
      </div>
      <p className="text-slate-600">{formatContactInfo(client.phone, client.email)}</p>
      <h2 className="text-lg font-medium">Historique des contrats</h2>
      <ul className="space-y-2">
        {client.occupancies.map((o) => (
          <li key={o.id} className="rounded-lg border p-3">
            <Link href={`/billboards/${o.billboardId}`} className="font-medium text-blue-700">
              {o.billboard.reference}
            </Link>
            <p className="text-sm text-slate-600">
              {o.contractRef ? `Contrat : ${o.contractRef}` : 'Sans référence'}
              {o.endDate ? ` — jusqu'au ${new Date(o.endDate).toLocaleDateString('fr-FR')}` : ' — durée indéterminée'}
            </p>
          </li>
        ))}
        {client.occupancies.length === 0 && (
          <li className="text-sm text-slate-500">Aucun contrat</li>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 5: Build and test check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean — this should be the last of the pre-existing type errors.

- [ ] **Step 6: Manual verification**

Run `docker compose up -d db && npm run dev`, log in as ADMIN, open a client, click "Modifier", change the phone number, save — confirm it persists. Log in as USER — confirm "Modifier" doesn't appear but "Supprimer" still does (routes to approval, per existing behavior).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/clients src/components/clients src/app/clients
git commit -m "feat: allow ADMIN/DEV to edit client name/phone/email"
```

---

### Task 13: Rename "Référence" to "Identifiant", fix the city-prefixes help text

**Files:**
- Modify: `src/components/table/BillboardTable.tsx`
- Modify: `src/app/settings/city-prefixes/page.tsx`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Rename the table header**

In `src/components/table/BillboardTable.tsx`, change `<TableHead>Référence</TableHead>` to `<TableHead>Identifiant</TableHead>`.

- [ ] **Step 2: Fix the city-prefixes settings page's heading and example text**

In `src/app/settings/city-prefixes/page.tsx` (around line 81-85), replace:

```tsx
      <h1 className="text-2xl font-semibold">Préfixes de référence par ville</h1>
      <p className="text-sm text-slate-600">
        Utilisé pour générer la référence des panneaux (ex: ANM 001 TNR). Une ville non listée ici
        utilise automatiquement ses 3 premières lettres en majuscules.
      </p>
```

with:

```tsx
      <h1 className="text-2xl font-semibold">Préfixes d&apos;identifiant par ville</h1>
      <p className="text-sm text-slate-600">
        Utilisé pour générer l&apos;identifiant des panneaux (ex: TNR 001). Une ville non listée ici
        utilise automatiquement ses 3 premières lettres en majuscules.
      </p>
```

- [ ] **Step 3: Update the seed data's stale comment and reference**

In `prisma/seed.ts`:
- Change the billboard's `reference: 'ANM 001 TNR'` (both the `where` and `create` occurrences) to `reference: 'TNR 001'`.
- In `seedCityPrefixes`, remove the now-inaccurate comment above the `Antalaha` entry (the one starting "Matches the reference template's fixed 'ANM' prefix...") — Antalaha's `ANM` prefix is simply its real airport code now, no longer collides with anything, since the generator no longer hardcodes `ANM` globally. Leave the `{ city: 'Antalaha', prefix: 'ANM' }` entry itself unchanged.
- Replace the `seedSampleData` function's `prisma.contract.upsert(...)` block with an `Occupancy` equivalent (no `amount`):

```ts
  await prisma.occupancy.upsert({
    where: { id: 'seed-occupancy-1' },
    update: {},
    create: {
      id: 'seed-occupancy-1',
      billboardId: billboard.id,
      clientId: client.id,
      contractRef: 'Contrat-Orange-2026.pdf',
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  })
```

- [ ] **Step 4: Build and test check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/table/BillboardTable.tsx src/app/settings/city-prefixes/page.tsx prisma/seed.ts
git commit -m "fix: rename Référence to Identifiant in the UI, update seed data and help text"
```

---

## Final verification (run once all tasks are complete)

```bash
npx tsc --noEmit
npx vitest run
npm run build
docker compose up -d --build
docker compose exec app npx prisma db seed
docker compose exec app npx tsx scripts/rewrite-billboard-references.ts
```

Then manually walk through, in the running app:
1. Confirm the seeded billboard's identifier reads `TNR 001` (not `ANM 001 TNR`) everywhere it appears (table, detail page title, PDF export filename).
2. On `/database`, filter by city — confirm only that city's billboards show.
3. Open a billboard, click "+ Nouveau contrat" — confirm the form asks for Client / Face / Référence du contrat / Date de fin, with no amount field anywhere.
4. Create a contract with a reference but no end date — confirm the billboard shows "En location" and the occupancy card shows "Durée indéterminée".
5. Create a second contract with an end date 10 days out — confirm the billboard's status becomes "Expire bientôt".
6. Open "Modifier" on a billboard — confirm Latitude/Longitude/Numéro d'autorisation/Référence taxe communale are all editable and save correctly.
7. Confirm nowhere in the app (dashboard, PDF export, contract form, history) shows an amount or "MGA" anywhere.
8. Open a client, click "Modifier" — confirm name/phone/email are editable and persist. Log in as USER — confirm "Modifier" is hidden but "Supprimer" still routes to the approval queue.
9. Confirm `/settings/city-prefixes`'s help text example reads `TNR 001`, not `ANM 001 TNR`.
10. Try editing a billboard's identifier — confirm there is no field anywhere (create or edit form) that allows it, for any role including DEV.
