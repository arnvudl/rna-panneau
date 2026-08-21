# CRM Panneaux Publicitaires RNA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web CRM for RNA to manage its billboard fleet: an interactive Madagascar map, a searchable/filterable database view, contract/client tracking, maintenance tracking, an approval workflow, and PDF export — replacing their current Excel-based process.

**Architecture:** Single Next.js (App Router, TypeScript) app. Server-side logic lives in API routes / server actions backed by Prisma + PostgreSQL. UI built with Tailwind + shadcn/ui. Map rendered client-side with MapLibre GL JS + `react-map-gl`. Auth via Auth.js (NextAuth) with a `role` field on the user. PDF generated server-side with `@react-pdf/renderer`.

**Tech Stack:** Next.js 14 (App Router, TS), Prisma, PostgreSQL (Supabase/Neon), Tailwind CSS, shadcn/ui, MapLibre GL JS + react-map-gl, Auth.js, @react-pdf/renderer, Vitest + Testing Library for tests.

Reference spec: `docs/superpowers/specs/2026-08-21-crm-panneaux-rna-design.md`

---

## File Structure Overview

```
prisma/
  schema.prisma
src/
  lib/
    prisma.ts              # Prisma client singleton
    auth.ts                # NextAuth config
    status.ts              # billboard status derivation logic
    reference.ts            # billboard reference generator
  app/
    layout.tsx
    page.tsx                 # redirects to /map
    login/page.tsx
    api/
      auth/[...nextauth]/route.ts
      billboards/route.ts           # GET (list+filter), POST (create)
      billboards/[id]/route.ts      # GET, PATCH, DELETE
      billboards/[id]/pdf/route.ts  # GET -> streams PDF
      contracts/route.ts            # POST
      contracts/[id]/route.ts       # PATCH
      maintenance/route.ts          # POST
      clients/route.ts              # GET, POST
      clients/[id]/route.ts         # GET
      approvals/route.ts            # GET (pending list), POST (create)
      approvals/[id]/route.ts       # PATCH (approve/reject)
    map/page.tsx                    # split-screen view (home)
    map/full/page.tsx               # map full-screen view
    database/page.tsx               # table full-screen view
    billboards/[id]/page.tsx        # dedicated billboard sheet
    clients/page.tsx
    clients/[id]/page.tsx
    dashboard/page.tsx
  components/
    map/
      BillboardMap.tsx              # shared MapLibre map component
      BillboardMarker.tsx
    table/
      BillboardTable.tsx            # shared sortable/filterable table
      FilterBar.tsx
    billboard/
      BillboardDrawer.tsx
      BillboardForm.tsx
      ContractPanel.tsx
      HistoryTimeline.tsx
      MaintenancePanel.tsx
      ExportPdfButton.tsx
    clients/
      ClientForm.tsx
    approvals/
      ApprovalQueue.tsx
    layout/
      Nav.tsx
      RoleGate.tsx
  types/
    billboard.ts
tests/
  lib/
    status.test.ts
    reference.test.ts
  api/
    billboards.test.ts
    approvals.test.ts
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `.gitignore`, `.env.example`

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir=false --import-alias "@/*" --eslint
```

Answer prompts: use `src/` directory = yes, App Router = yes.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs zod react-map-gl maplibre-gl @react-pdf/renderer date-fns
npm install -D prisma vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label table tabs badge dialog drawer dropdown-menu select textarea sonner
```

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL="postgresql://user:password@host:5432/dbname"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET="billboard-photos"
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, shadcn/ui, Prisma, Vitest"
```

---

## Task 2: Prisma schema and database client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Write the schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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

enum ApprovalType {
  CREATE_CONTRACT
  EDIT_CONTRACT
  DELETE_BILLBOARD
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

  approvalRequests   ApprovalRequest[] @relation("RequestedBy")
  reviewedApprovals  ApprovalRequest[] @relation("ReviewedBy")
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
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  contracts          Contract[]
  maintenanceRecords MaintenanceRecord[]
}

model Client {
  id          String   @id @default(cuid())
  name        String
  contactInfo String?
  createdAt   DateTime @default(now())

  contracts Contract[]
}

model Contract {
  id          String         @id @default(cuid())
  billboardId String
  clientId    String
  startDate   DateTime
  endDate     DateTime
  amount      Float
  status      ContractStatus @default(ACTIVE)
  createdAt   DateTime       @default(now())

  billboard Billboard @relation(fields: [billboardId], references: [id])
  client    Client    @relation(fields: [clientId], references: [id])
}

model MaintenanceRecord {
  id          String   @id @default(cuid())
  billboardId String
  date        DateTime
  type        String
  comment     String?
  technicianId String?

  billboard  Billboard @relation(fields: [billboardId], references: [id])
  technician User?     @relation(fields: [technicianId], references: [id])
}

model ApprovalRequest {
  id           String         @id @default(cuid())
  requestedById String
  type         ApprovalType
  payload      Json
  status       ApprovalStatus @default(PENDING)
  reviewedById String?
  reviewedAt   DateTime?
  createdAt    DateTime       @default(now())

  requestedBy User  @relation("RequestedBy", fields: [requestedById], references: [id])
  reviewedBy  User? @relation("ReviewedBy", fields: [reviewedById], references: [id])
}
```

- [ ] **Step 2: Create Prisma client singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Generate client and run first migration**

Run: `npx prisma migrate dev --name init`
Expected: migration created under `prisma/migrations/`, Prisma Client generated with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma src/lib/prisma.ts
git commit -m "feat: add Prisma schema for billboards, contracts, clients, maintenance, approvals"
```

---

## Task 3: Billboard status derivation and reference generation

**Files:**
- Create: `src/lib/status.ts`
- Create: `src/lib/reference.ts`
- Test: `tests/lib/status.test.ts`
- Test: `tests/lib/reference.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/status.test.ts
import { describe, it, expect } from 'vitest'
import { deriveBillboardStatus } from '@/lib/status'

const activeContract = (daysUntilEnd: number) => ({
  status: 'ACTIVE' as const,
  endDate: new Date(Date.now() + daysUntilEnd * 24 * 60 * 60 * 1000),
})

describe('deriveBillboardStatus', () => {
  it('returns MAINTENANCE when the billboard is flagged damaged', () => {
    expect(deriveBillboardStatus({ damaged: true, contracts: [] })).toBe('MAINTENANCE')
  })

  it('returns AVAILABLE when there is no active contract', () => {
    expect(deriveBillboardStatus({ damaged: false, contracts: [] })).toBe('AVAILABLE')
  })

  it('returns RENTED when the active contract ends in more than 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, contracts: [activeContract(60)] })
    ).toBe('RENTED')
  })

  it('returns EXPIRING_SOON when the active contract ends within 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, contracts: [activeContract(10)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRED when the active contract end date is in the past', () => {
    expect(
      deriveBillboardStatus({ damaged: false, contracts: [activeContract(-5)] })
    ).toBe('EXPIRED')
  })
})
```

```typescript
// tests/lib/reference.test.ts
import { describe, it, expect } from 'vitest'
import { generateReference } from '@/lib/reference'

describe('generateReference', () => {
  it('formats as ANM <padded-number> <city-code>', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo' })).toBe('ANM 001 TNR')
  })

  it('pads sequence numbers under 100', () => {
    expect(generateReference({ sequence: 42, city: 'Toamasina' })).toBe('ANM 042 TOA')
  })

  it('does not pad sequence numbers over 999', () => {
    expect(generateReference({ sequence: 1234, city: 'Fianarantsoa' })).toBe('ANM 1234 FIA')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Cannot find module '@/lib/status'" and "Cannot find module '@/lib/reference'"

- [ ] **Step 3: Implement `deriveBillboardStatus`**

```typescript
// src/lib/status.ts
export type BillboardStatus =
  | 'AVAILABLE'
  | 'RENTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'MAINTENANCE'

const EXPIRING_SOON_WINDOW_DAYS = 30

export function deriveBillboardStatus(billboard: {
  damaged: boolean
  contracts: { status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'; endDate: Date }[]
}): BillboardStatus {
  if (billboard.damaged) return 'MAINTENANCE'

  const activeContract = billboard.contracts.find((c) => c.status === 'ACTIVE')
  if (!activeContract) return 'AVAILABLE'

  const now = new Date()
  const msUntilEnd = activeContract.endDate.getTime() - now.getTime()
  const daysUntilEnd = msUntilEnd / (24 * 60 * 60 * 1000)

  if (daysUntilEnd < 0) return 'EXPIRED'
  if (daysUntilEnd <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'
  return 'RENTED'
}
```

- [ ] **Step 4: Implement `generateReference`**

```typescript
// src/lib/reference.ts
const CITY_CODES: Record<string, string> = {
  Antananarivo: 'TNR',
  Toamasina: 'TOA',
  Fianarantsoa: 'FIA',
  Mahajanga: 'MJN',
  Toliara: 'TLE',
  Antsiranda: 'DIE',
}

export function cityCode(city: string): string {
  return CITY_CODES[city] ?? city.slice(0, 3).toUpperCase()
}

export function generateReference({
  sequence,
  city,
}: {
  sequence: number
  city: string
}): string {
  const padded = sequence < 1000 ? String(sequence).padStart(3, '0') : String(sequence)
  return `ANM ${padded} ${cityCode(city)}`
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/status.ts src/lib/reference.ts tests/lib/status.test.ts tests/lib/reference.test.ts
git commit -m "feat: add billboard status derivation and reference generation"
```

---

## Task 4: Auth (Auth.js, roles, seed users)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `prisma/seed.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Configure NextAuth with credentials provider**

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.role = (user as { role: string }).role
      return token
    },
    session: ({ session, token }) => {
      if (session.user) (session.user as typeof session.user & { role: string }).role = token.role as string
      return session
    },
  },
})
```

- [ ] **Step 2: Add route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 3: Extend session types**

```typescript
// src/types/next-auth.d.ts
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: 'DEV' | 'ADMIN' | 'USER'
    }
  }
}
```

- [ ] **Step 4: Build login page**

```tsx
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Email ou mot de passe incorrect')
      return
    }
    router.push('/map')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">RNA — Connexion</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">Se connecter</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Seed script with 3 real users (dev, admin, user)**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const users = [
    { email: 'dev@rna.mg', password: process.env.SEED_DEV_PASSWORD ?? 'changeme-dev', role: 'DEV' as const },
    { email: 'admin@rna.mg', password: process.env.SEED_ADMIN_PASSWORD ?? 'changeme-admin', role: 'ADMIN' as const },
    { email: 'user@rna.mg', password: process.env.SEED_USER_PASSWORD ?? 'changeme-user', role: 'USER' as const },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, role: u.role },
    })
  }
}

main().finally(() => prisma.$disconnect())
```

Add to `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }` and `npm install -D tsx`.

- [ ] **Step 6: Run the seed and manually verify login**

Run: `npx prisma db seed`
Expected: 3 users created with no errors.

Run: `npm run dev`, open `http://localhost:3000/login`, log in as `admin@rna.mg`.
Expected: redirected to `/map` (page not yet built — 404 is acceptable at this step; confirm no auth error is thrown).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/app/login src/types/next-auth.d.ts prisma/seed.ts package.json
git commit -m "feat: add Auth.js credentials login with role-based sessions and seed users"
```

---

## Task 5: Route protection middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware that redirects unauthenticated users to /login**

```typescript
// src/middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/map', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, visit `http://localhost:3000/dashboard` while logged out.
Expected: redirected to `/login`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: protect all routes behind authentication via middleware"
```

---

## Task 6: Billboards API (list with filters, create, get, update, delete)

**Files:**
- Create: `src/app/api/billboards/route.ts`
- Create: `src/app/api/billboards/[id]/route.ts`
- Test: `tests/api/billboards.test.ts`

- [ ] **Step 1: Write the failing test for the filter query logic**

```typescript
// tests/api/billboards.test.ts
import { describe, it, expect } from 'vitest'
import { buildBillboardWhere } from '@/app/api/billboards/route'

describe('buildBillboardWhere', () => {
  it('returns an empty object when no filters are given', () => {
    expect(buildBillboardWhere(new URLSearchParams())).toEqual({})
  })

  it('filters by city and damaged', () => {
    const params = new URLSearchParams({ city: 'Toamasina', damaged: 'true' })
    expect(buildBillboardWhere(params)).toEqual({ city: 'Toamasina', damaged: true })
  })

  it('filters by dimension', () => {
    const params = new URLSearchParams({ dimension: 'D4X3' })
    expect(buildBillboardWhere(params)).toEqual({ dimension: 'D4X3' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '@/app/api/billboards/route'" (module doesn't exist yet)

- [ ] **Step 3: Implement the collection route**

```typescript
// src/app/api/billboards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deriveBillboardStatus } from '@/lib/status'
import { generateReference } from '@/lib/reference'
import type { Prisma } from '@prisma/client'

export function buildBillboardWhere(params: URLSearchParams): Prisma.BillboardWhereInput {
  const where: Prisma.BillboardWhereInput = {}
  const city = params.get('city')
  const dimension = params.get('dimension')
  const damaged = params.get('damaged')

  if (city) where.city = city
  if (dimension) where.dimension = dimension as Prisma.BillboardWhereInput['dimension']
  if (damaged !== null) where.damaged = damaged === 'true'

  return where
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = buildBillboardWhere(req.nextUrl.searchParams)
  const billboards = await prisma.billboard.findMany({
    where,
    include: { contracts: { where: { status: 'ACTIVE' } } },
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
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = createSchema.parse(await req.json())
  const count = await prisma.billboard.count({ where: { city: body.city } })
  const reference = generateReference({ sequence: count + 1, city: body.city })

  const billboard = await prisma.billboard.create({
    data: { ...body, reference },
  })

  return NextResponse.json(billboard, { status: 201 })
}
```

- [ ] **Step 4: Implement the item route**

```typescript
// src/app/api/billboards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deriveBillboardStatus } from '@/lib/status'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...billboard, status: deriveBillboardStatus(billboard) })
}

const patchSchema = z.object({
  damaged: z.boolean().optional(),
  currentPhotoUrl: z.string().url().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = patchSchema.parse(await req.json())

  // USER role may only update the photo (part of "add photo" workflow); damaged
  // status is not sensitive enough to require approval per spec, but deletion is.
  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: body })
  return NextResponse.json(billboard)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role === 'USER') {
    await prisma.approvalRequest.create({
      data: {
        requestedById: session.user.id,
        type: 'DELETE_BILLBOARD',
        payload: { billboardId: params.id },
      },
    })
    return NextResponse.json({ status: 'pending_approval' }, { status: 202 })
  }

  await prisma.billboard.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/billboards tests/api/billboards.test.ts
git commit -m "feat: add billboards API with filtering, creation, and approval-gated deletion"
```

---

## Task 7: Clients and Contracts API

**Files:**
- Create: `src/app/api/clients/route.ts`
- Create: `src/app/api/clients/[id]/route.ts`
- Create: `src/app/api/contracts/route.ts`
- Create: `src/app/api/contracts/[id]/route.ts`

- [ ] **Step 1: Implement clients collection route**

```typescript
// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')
  const clients = await prisma.client.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(clients)
}

const createSchema = z.object({ name: z.string().min(1), contactInfo: z.string().optional() })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = createSchema.parse(await req.json())
  const client = await prisma.client.create({ data: body })
  return NextResponse.json(client, { status: 201 })
}
```

- [ ] **Step 2: Implement client detail route**

```typescript
// src/app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contracts: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client)
}
```

- [ ] **Step 3: Implement contracts collection route (create, with approval gate)**

```typescript
// src/app/api/contracts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const createSchema = z.object({
  billboardId: z.string(),
  clientId: z.string(),
  startDate: z.string().datetime(),
  amount: z.number().positive(),
  durationMonths: z.number().int().positive().default(6),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.parse(await req.json())
  const startDate = new Date(body.startDate)
  const endDate = addMonths(startDate, body.durationMonths)

  if (session.user.role === 'USER') {
    const request = await prisma.approvalRequest.create({
      data: {
        requestedById: session.user.id,
        type: 'CREATE_CONTRACT',
        payload: { ...body, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      },
    })
    return NextResponse.json(request, { status: 202 })
  }

  const contract = await prisma.contract.create({
    data: {
      billboardId: body.billboardId,
      clientId: body.clientId,
      startDate,
      endDate,
      amount: body.amount,
    },
  })
  return NextResponse.json(contract, { status: 201 })
}
```

- [ ] **Step 4: Implement contract update route (terminate/renew, with approval gate)**

```typescript
// src/app/api/contracts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  endDate: z.string().datetime().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = patchSchema.parse(await req.json())
  const data = { ...body, endDate: body.endDate ? new Date(body.endDate) : undefined }

  if (session.user.role === 'USER') {
    const request = await prisma.approvalRequest.create({
      data: {
        requestedById: session.user.id,
        type: 'EDIT_CONTRACT',
        payload: { contractId: params.id, ...body },
      },
    })
    return NextResponse.json(request, { status: 202 })
  }

  const contract = await prisma.contract.update({ where: { id: params.id }, data })
  return NextResponse.json(contract)
}
```

- [ ] **Step 5: Manually verify with dev server**

Run: `npm run dev`, then in another terminal:

```bash
curl -X POST http://localhost:3000/api/clients -H "Content-Type: application/json" -d '{"name":"Orange Madagascar"}' -b cookies.txt
```

Expected: 401 without a session cookie (confirms auth is enforced); full end-to-end check happens once the UI is wired in Task 10.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/clients src/app/api/contracts
git commit -m "feat: add clients and contracts API with approval-gated writes for USER role"
```

---

## Task 8: Maintenance and Approvals API

**Files:**
- Create: `src/app/api/maintenance/route.ts`
- Create: `src/app/api/approvals/route.ts`
- Create: `src/app/api/approvals/[id]/route.ts`

- [ ] **Step 1: Implement maintenance creation route**

```typescript
// src/app/api/maintenance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const createSchema = z.object({
  billboardId: z.string(),
  date: z.string().datetime(),
  type: z.string().min(1),
  comment: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.parse(await req.json())
  const record = await prisma.maintenanceRecord.create({
    data: { ...body, date: new Date(body.date), technicianId: session.user.id },
  })
  return NextResponse.json(record, { status: 201 })
}
```

- [ ] **Step 2: Implement approvals list + item routes**

```typescript
// src/app/api/approvals/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requests = await prisma.approvalRequest.findMany({
    where: { status: 'PENDING' },
    include: { requestedBy: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(requests)
}
```

```typescript
// src/app/api/approvals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const patchSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { decision } = patchSchema.parse(await req.json())
  const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: params.id } })

  if (decision === 'APPROVED') {
    await applyApproval(approval)
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: params.id },
    data: { status: decision, reviewedById: session.user.id, reviewedAt: new Date() },
  })
  return NextResponse.json(updated)
}

async function applyApproval(approval: { type: string; payload: unknown }) {
  const payload = approval.payload as Record<string, unknown>
  switch (approval.type) {
    case 'CREATE_CONTRACT':
      await prisma.contract.create({
        data: {
          billboardId: payload.billboardId as string,
          clientId: payload.clientId as string,
          startDate: new Date(payload.startDate as string),
          endDate: new Date(payload.endDate as string),
          amount: payload.amount as number,
        },
      })
      break
    case 'EDIT_CONTRACT':
      await prisma.contract.update({
        where: { id: payload.contractId as string },
        data: {
          status: payload.status as 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | undefined,
          endDate: payload.endDate ? new Date(payload.endDate as string) : undefined,
        },
      })
      break
    case 'DELETE_BILLBOARD':
      await prisma.billboard.delete({ where: { id: payload.billboardId as string } })
      break
    case 'EDIT_PRICE':
      await prisma.contract.update({
        where: { id: payload.contractId as string },
        data: { amount: payload.amount as number },
      })
      break
  }
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, log in as `user@rna.mg` via `/login`, then from browser dev console call `fetch('/api/contracts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({billboardId:'x', clientId:'y', startDate:new Date().toISOString(), amount: 100}) })`.
Expected: 202 with `status: pending_approval`-shaped response (actual `billboardId`/`clientId` will fail FK constraint once real IDs are seeded in Task 12 — acceptable at this step, confirms role branching works).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/maintenance src/app/api/approvals
git commit -m "feat: add maintenance records API and approval review workflow"
```

---

## Task 9: PDF export for billboard sheet

**Files:**
- Create: `src/app/api/billboards/[id]/pdf/route.ts`
- Create: `src/components/billboard/BillboardPdfDocument.tsx`

- [ ] **Step 1: Build the PDF document component**

```tsx
// src/components/billboard/BillboardPdfDocument.tsx
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
  contracts: { clientName: string; startDate: string; endDate: string; amount: number }[]
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
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Historique des contrats</Text>
          {data.contracts.map((c, i) => (
            <View key={i} style={styles.row}>
              <Text>{c.clientName}</Text>
              <Text>{c.startDate} → {c.endDate} ({c.amount} MGA)</Text>
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

- [ ] **Step 2: Implement the PDF streaming route**

```typescript
// src/app/api/billboards/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deriveBillboardStatus } from '@/lib/status'
import { BillboardPdfDocument } from '@/components/billboard/BillboardPdfDocument'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
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
        contracts: billboard.contracts.map((c) => ({
          clientName: c.client.name,
          startDate: c.startDate.toLocaleDateString('fr-FR'),
          endDate: c.endDate.toLocaleDateString('fr-FR'),
          amount: c.amount,
        })),
        maintenanceRecords: billboard.maintenanceRecords.map((m) => ({
          date: m.date.toLocaleDateString('fr-FR'),
          type: m.type,
          comment: m.comment,
        })),
      },
    })
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${billboard.reference}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Manually verify once seed data exists (deferred check in Task 12)**

Note: full verification requires a seeded billboard; re-run this check at the end of Task 12.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billboards/[id]/pdf src/components/billboard/BillboardPdfDocument.tsx
git commit -m "feat: add PDF export for individual billboard sheets"
```

---

## Task 10: Map component and split-screen home view

**Files:**
- Create: `src/components/map/BillboardMap.tsx`
- Create: `src/components/table/BillboardTable.tsx`
- Create: `src/components/table/FilterBar.tsx`
- Create: `src/components/billboard/BillboardDrawer.tsx`
- Create: `src/app/map/page.tsx`
- Create: `src/components/layout/Nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Build the shared map component**

```tsx
// src/components/map/BillboardMap.tsx
'use client'

import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useState } from 'react'

const MADAGASCAR_BOUNDS: [[number, number], [number, number]] = [
  [42.0, -26.0],
  [51.0, -11.5],
]

const STYLE_PLAN = {
  version: 8 as const,
  sources: {
    osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

const STYLE_SATELLITE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [{ id: 'esri', type: 'raster' as const, source: 'esri' }],
}

export type BillboardPin = {
  id: string
  lat: number
  lng: number
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#16a34a',
  RENTED: '#2563eb',
  EXPIRING_SOON: '#f97316',
  EXPIRED: '#dc2626',
  MAINTENANCE: '#6b7280',
}

export function BillboardMap({
  billboards,
  onSelect,
  selectedId,
  onMapRightClick,
}: {
  billboards: BillboardPin[]
  onSelect: (id: string) => void
  selectedId?: string | null
  onMapRightClick?: (lngLat: { lat: number; lng: number }) => void
}) {
  const [satellite, setSatellite] = useState(false)

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={{ longitude: 47.0, latitude: -19.0, zoom: 5 }}
        maxBounds={MADAGASCAR_BOUNDS}
        mapStyle={satellite ? STYLE_SATELLITE : STYLE_PLAN}
        onContextMenu={(e) => {
          e.preventDefault()
          onMapRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }}
      >
        <NavigationControl position="top-left" />
        {billboards.map((b) => (
          <Marker key={b.id} longitude={b.lng} latitude={b.lat} onClick={() => onSelect(b.id)}>
            <div
              className="h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow"
              style={{
                backgroundColor: STATUS_COLORS[b.status] ?? '#000',
                outline: selectedId === b.id ? '2px solid #1d4ed8' : 'none',
              }}
            />
          </Marker>
        ))}
      </Map>
      <button
        onClick={() => setSatellite((s) => !s)}
        className="absolute right-3 top-3 rounded-md bg-white px-3 py-1.5 text-sm font-medium shadow"
      >
        {satellite ? 'Vue plan' : 'Vue satellite'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Build the filter bar**

```tsx
// src/components/table/FilterBar.tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Filters = { status?: string; city?: string; dimension?: string; damaged?: string }

const STATUSES = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']
const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-b bg-white p-3">
      <Select value={filters.status ?? 'all'} onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.dimension ?? 'all'} onValueChange={(v) => onChange({ ...filters, dimension: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Dimension" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes dimensions</SelectItem>
          {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d.replace('D', '').replace('X', 'x')}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.damaged ?? 'all'} onValueChange={(v) => onChange({ ...filters, damaged: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Endommagé" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          <SelectItem value="true">Endommagé</SelectItem>
          <SelectItem value="false">Non endommagé</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 3: Build the shared table component**

```tsx
// src/components/table/BillboardTable.tsx
'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export type BillboardRow = {
  id: string
  reference: string
  city: string
  dimension: string
  status: string
  damaged: boolean
  activeClientName?: string
}

export function BillboardTable({
  rows,
  onSelect,
  selectedId,
}: {
  rows: BillboardRow[]
  onSelect: (id: string) => void
  selectedId?: string | null
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Référence</TableHead>
          <TableHead>Ville</TableHead>
          <TableHead>Dimension</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Client</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`cursor-pointer ${selectedId === r.id ? 'bg-blue-50' : ''}`}
          >
            <TableCell className="font-medium">{r.reference}</TableCell>
            <TableCell>{r.city}</TableCell>
            <TableCell>{r.dimension.replace('D', '').replace('X', 'x')}</TableCell>
            <TableCell>
              <Badge variant="outline">{r.status}</Badge>
              {r.damaged && <Badge variant="destructive" className="ml-1">Endommagé</Badge>}
            </TableCell>
            <TableCell>{r.activeClientName ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: Build the billboard drawer**

```tsx
// src/components/billboard/BillboardDrawer.tsx
'use client'

import Link from 'next/link'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import type { BillboardRow } from '@/components/table/BillboardTable'

export function BillboardDrawer({
  billboard,
  open,
  onOpenChange,
}: {
  billboard: BillboardRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="ml-auto h-full w-96">
        <DrawerHeader>
          <DrawerTitle>{billboard?.reference}</DrawerTitle>
        </DrawerHeader>
        {billboard && (
          <div className="space-y-3 p-4">
            <p className="text-sm text-slate-600">{billboard.city} — {billboard.dimension}</p>
            <p className="text-sm">Statut: {billboard.status}</p>
            <Button asChild className="w-full">
              <Link href={`/billboards/${billboard.id}`}>Voir en détail</Link>
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 5: Build the split-screen home page**

```tsx
// src/app/map/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { BillboardTable, type BillboardRow } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'

type BillboardApiItem = BillboardRow & { lat: number; lng: number }

export default function MapPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [billboards, setBillboards] = useState<BillboardApiItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(filters as Record<string, string>)
    fetch(`/api/billboards?${params}`)
      .then((r) => r.json())
      .then(setBillboards)
  }, [filters])

  const select = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const selected = billboards.find((b) => b.id === selectedId) ?? null

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r">
          <BillboardMap
            billboards={billboards}
            onSelect={select}
            selectedId={selectedId}
          />
        </div>
        <div className="w-1/2 overflow-auto">
          <BillboardTable rows={billboards} onSelect={select} selectedId={selectedId} />
        </div>
      </div>
      <BillboardDrawer billboard={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}
```

- [ ] **Step 6: Build the nav and wire the root layout**

```tsx
// src/components/layout/Nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/map', label: 'Carte + BD' },
  { href: '/map/full', label: 'Carte' },
  { href: '/database', label: 'Base de données' },
  { href: '/clients', label: 'Clients' },
  { href: '/dashboard', label: 'Dashboard' },
]

export function Nav() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <nav className="flex h-14 items-center gap-4 border-b bg-blue-900 px-4 text-white">
      <span className="font-semibold">RNA</span>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`text-sm ${pathname === l.href ? 'font-semibold underline' : 'text-blue-100'}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
```

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/layout/Nav'

export const metadata: Metadata = { title: 'RNA — Gestion des panneaux' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Manually verify (deferred to Task 12 once seed data exists)**

- [ ] **Step 8: Commit**

```bash
git add src/components/map src/components/table src/components/billboard/BillboardDrawer.tsx src/app/map/page.tsx src/components/layout/Nav.tsx src/app/layout.tsx
git commit -m "feat: add split-screen map+table home view with filters and drawer"
```

---

## Task 11: Full-screen map, full-screen database, and dedicated billboard sheet pages

**Files:**
- Create: `src/app/map/full/page.tsx`
- Create: `src/app/database/page.tsx`
- Create: `src/components/billboard/BillboardForm.tsx`
- Create: `src/components/billboard/ContractPanel.tsx`
- Create: `src/components/billboard/HistoryTimeline.tsx`
- Create: `src/components/billboard/MaintenancePanel.tsx`
- Create: `src/components/billboard/ExportPdfButton.tsx`
- Create: `src/app/billboards/[id]/page.tsx`

- [ ] **Step 1: Full-screen map page with add-billboard form**

```tsx
// src/components/billboard/BillboardForm.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

export function BillboardForm({
  open,
  onOpenChange,
  initialLatLng,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLatLng: { lat: number; lng: number } | null
  onCreated: () => void
}) {
  const [city, setCity] = useState('')
  const [dimension, setDimension] = useState('D4X3')
  const [sides, setSides] = useState<1 | 2>(1)

  const submit = async () => {
    if (!initialLatLng) return
    await fetch('/api/billboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...initialLatLng, city, dimension, sides }),
    })
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter un panneau</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Ville</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Dimension</Label>
            <Select value={dimension} onValueChange={setDimension}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Faces</Label>
            <Select value={String(sides)} onValueChange={(v) => setSides(Number(v) as 1 | 2)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 face</SelectItem>
                <SelectItem value="2">2 faces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submit} className="w-full">Créer</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

```tsx
// src/app/map/full/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { Button } from '@/components/ui/button'
import type { BillboardRow } from '@/components/table/BillboardTable'

export default function MapFullPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [billboards, setBillboards] = useState<(BillboardRow & { lat: number; lng: number })[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null)

  const reload = () => {
    const params = new URLSearchParams(filters as Record<string, string>)
    fetch(`/api/billboards?${params}`).then((r) => r.json()).then(setBillboards)
  }

  useEffect(reload, [filters])

  return (
    <div className="relative h-[calc(100vh-56px)]">
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="h-[calc(100%-56px)]">
        <BillboardMap
          billboards={billboards}
          onSelect={(id) => { setSelectedId(id); setDrawerOpen(true) }}
          selectedId={selectedId}
          onMapRightClick={(latLng) => { setPendingLatLng(latLng); setFormOpen(true) }}
        />
      </div>
      <Button className="absolute bottom-6 right-6" onClick={() => setPendingLatLng({ lat: -19, lng: 47 })}>
        + Ajouter un panneau
      </Button>
      <BillboardDrawer billboard={billboards.find((b) => b.id === selectedId) ?? null} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <BillboardForm open={formOpen} onOpenChange={setFormOpen} initialLatLng={pendingLatLng} onCreated={reload} />
    </div>
  )
}
```

- [ ] **Step 2: Full-screen database page**

```tsx
// src/app/database/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { BillboardTable, type BillboardRow } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { useRouter } from 'next/navigation'

export default function DatabasePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({})
  const [billboards, setBillboards] = useState<BillboardRow[]>([])

  useEffect(() => {
    const params = new URLSearchParams(filters as Record<string, string>)
    fetch(`/api/billboards?${params}`).then((r) => r.json()).then(setBillboards)
  }, [filters])

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto">
      <FilterBar filters={filters} onChange={setFilters} />
      <BillboardTable rows={billboards} onSelect={(id) => router.push(`/billboards/${id}`)} />
    </div>
  )
}
```

- [ ] **Step 3: Billboard sheet sub-components**

```tsx
// src/components/billboard/ContractPanel.tsx
import { Button } from '@/components/ui/button'

type Contract = { id: string; client: { name: string }; startDate: string; endDate: string; amount: number; status: string }

export function ContractPanel({ contract, billboardId }: { contract: Contract | undefined; billboardId: string }) {
  if (!contract) return <p className="text-sm text-slate-500">Aucun contrat en cours.</p>

  const terminate = async () => {
    await fetch(`/api/contracts/${contract.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'TERMINATED' }),
    })
    location.reload()
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="font-medium">{contract.client.name}</p>
      <p className="text-sm text-slate-600">
        {new Date(contract.startDate).toLocaleDateString('fr-FR')} → {new Date(contract.endDate).toLocaleDateString('fr-FR')}
      </p>
      <p className="text-sm">{contract.amount} MGA</p>
      <Button variant="outline" onClick={terminate}>Terminer le contrat</Button>
    </div>
  )
}
```

```tsx
// src/components/billboard/HistoryTimeline.tsx
type Contract = { id: string; client: { name: string }; startDate: string; endDate: string; amount: number }

export function HistoryTimeline({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) return <p className="text-sm text-slate-500">Aucun historique.</p>

  return (
    <ul className="space-y-3">
      {contracts.map((c) => (
        <li key={c.id} className="border-l-2 border-blue-200 pl-3">
          <p className="font-medium">{c.client.name}</p>
          <p className="text-sm text-slate-600">
            {new Date(c.startDate).toLocaleDateString('fr-FR')} → {new Date(c.endDate).toLocaleDateString('fr-FR')} — {c.amount} MGA
          </p>
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// src/components/billboard/MaintenancePanel.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Record = { id: string; date: string; type: string; comment: string | null }

export function MaintenancePanel({ billboardId, records }: { billboardId: string; records: Record[] }) {
  const [type, setType] = useState('')
  const [comment, setComment] = useState('')

  const submit = async () => {
    await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billboardId, date: new Date().toISOString(), type, comment }),
    })
    location.reload()
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {records.map((r) => (
          <li key={r.id} className="text-sm">
            {new Date(r.date).toLocaleDateString('fr-FR')} — {r.type} {r.comment && `(${r.comment})`}
          </li>
        ))}
      </ul>
      <div className="space-y-2 rounded-lg border p-3">
        <Input placeholder="Type (ex: antirouille)" value={type} onChange={(e) => setType(e.target.value)} />
        <Textarea placeholder="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button onClick={submit}>Ajouter intervention</Button>
      </div>
    </div>
  )
}
```

```tsx
// src/components/billboard/ExportPdfButton.tsx
'use client'

import { Button } from '@/components/ui/button'

export function ExportPdfButton({ billboardId }: { billboardId: string }) {
  return (
    <Button variant="outline" onClick={() => window.open(`/api/billboards/${billboardId}/pdf`, '_blank')}>
      Exporter en PDF
    </Button>
  )
}
```

- [ ] **Step 4: Dedicated billboard sheet page**

```tsx
// src/app/billboards/[id]/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ContractPanel } from '@/components/billboard/ContractPanel'
import { HistoryTimeline } from '@/components/billboard/HistoryTimeline'
import { MaintenancePanel } from '@/components/billboard/MaintenancePanel'
import { ExportPdfButton } from '@/components/billboard/ExportPdfButton'

export default async function BillboardPage({ params }: { params: { id: string } }) {
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) notFound()

  const status = deriveBillboardStatus(billboard)
  const activeContract = billboard.contracts.find((c) => c.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{billboard.reference}</h1>
          <p className="text-slate-600">{billboard.city} — {billboard.dimension} — {billboard.sides} face(s)</p>
        </div>
        <ExportPdfButton billboardId={billboard.id} />
      </div>

      <div className="flex gap-2">
        <Badge>{status}</Badge>
        {billboard.damaged && <Badge variant="destructive">Endommagé</Badge>}
      </div>

      {billboard.currentPhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={billboard.currentPhotoUrl} alt={billboard.reference} className="w-full rounded-xl object-cover" />
      )}

      <Tabs defaultValue="contract">
        <TabsList>
          <TabsTrigger value="contract">Contrat en cours</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="maintenance">Entretien</TabsTrigger>
        </TabsList>
        <TabsContent value="contract">
          <ContractPanel contract={activeContract as never} billboardId={billboard.id} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTimeline contracts={billboard.contracts as never} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords as never} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 5: Manually verify (deferred to Task 12 once seed data exists)**

- [ ] **Step 6: Commit**

```bash
git add src/app/map/full src/app/database src/app/billboards src/components/billboard
git commit -m "feat: add full-screen map, full-screen database, and dedicated billboard sheet pages"
```

---

## Task 12: Seed sample data and end-to-end manual verification

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Extend seed script with sample billboards, clients, and a contract**

```typescript
// prisma/seed.ts — append before `main().finally(...)`
async function seedSampleData() {
  const client = await prisma.client.upsert({
    where: { id: 'seed-client-orange' },
    update: {},
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', contactInfo: 'contact@orange.mg' },
  })

  const billboard = await prisma.billboard.upsert({
    where: { reference: 'ANM 001 TNR' },
    update: {},
    create: {
      reference: 'ANM 001 TNR',
      lat: -18.8792,
      lng: 47.5079,
      city: 'Antananarivo',
      dimension: 'D4X3',
      sides: 2,
    },
  })

  await prisma.contract.upsert({
    where: { id: 'seed-contract-1' },
    update: {},
    create: {
      id: 'seed-contract-1',
      billboardId: billboard.id,
      clientId: client.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      amount: 1500000,
      status: 'ACTIVE',
    },
  })
}
```

Call it from `main()`: add `await seedSampleData()` after the users loop.

- [ ] **Step 2: Re-run the seed**

Run: `npx prisma db seed`
Expected: no errors; 1 client, 1 billboard, 1 contract created (or already existing via upsert).

- [ ] **Step 3: End-to-end manual walkthrough**

Run: `npm run dev`

1. Visit `/login`, sign in as `admin@rna.mg`.
2. Expected: redirected to `/map`, split-screen shows the map on the left and a table row for `ANM 001 TNR` on the right, both centered on Antananarivo.
3. Click the table row. Expected: drawer opens on the right with billboard summary and a "Voir en détail" link.
4. Click "Voir en détail". Expected: navigates to `/billboards/<id>`, shows tabs for Contrat en cours / Historique / Entretien, contract tab shows Orange Madagascar.
5. Click "Exporter en PDF". Expected: a PDF downloads/opens with the billboard reference, contract, and (empty) maintenance history.
6. Navigate to `/map/full`. Expected: map only, no table. Right-click the map opens the "Ajouter un panneau" dialog.
7. Navigate to `/database`. Expected: table only, no map, same filters available; filtering by "Endommagé" hides/shows the seeded billboard correctly (it is not damaged, so it should disappear when filtering to `Endommagé`).
8. Navigate to `/clients`, then the Orange Madagascar client (once Task 13 is complete — otherwise 404 is expected at this point, note and continue).
9. Log out, log in as `user@rna.mg`, attempt to delete the billboard via `/billboards/<id>` (once delete UI exists in a later pass) — for now, verify via `curl`/devtools that `DELETE /api/billboards/<id>` returns `202 pending_approval` for this role.
10. Log in as `admin@rna.mg`, visit `/dashboard` (once Task 14 is complete) and approve the pending request.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed sample billboard, client, and contract for manual verification"
```

---

## Task 13: Clients pages

**Files:**
- Create: `src/app/clients/page.tsx`
- Create: `src/app/clients/[id]/page.tsx`
- Create: `src/components/clients/ClientForm.tsx`

- [ ] **Step 1: Client creation form component**

```tsx
// src/components/clients/ClientForm.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ClientForm({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [contactInfo, setContactInfo] = useState('')

  const submit = async () => {
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contactInfo }),
    })
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nom de l'entreprise" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Coordonnées" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          <Button onClick={submit} className="w-full">Créer</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Client list page**

```tsx
// src/app/clients/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClientForm } from '@/components/clients/ClientForm'

type Client = { id: string; name: string; contactInfo: string | null }

export default function ClientsPage() {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [formOpen, setFormOpen] = useState(false)

  const reload = () => {
    fetch(`/api/clients?q=${encodeURIComponent(query)}`).then((r) => r.json()).then(setClients)
  }

  useEffect(reload, [query])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={() => setFormOpen(true)}>+ Nouveau client</Button>
      </div>
      <Input placeholder="Rechercher..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="divide-y rounded-lg border">
        {clients.map((c) => (
          <li key={c.id}>
            <Link href={`/clients/${c.id}`} className="block p-3 hover:bg-slate-50">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-slate-500">{c.contactInfo}</p>
            </Link>
          </li>
        ))}
      </ul>
      <ClientForm open={formOpen} onOpenChange={setFormOpen} onCreated={reload} />
    </div>
  )
}
```

- [ ] **Step 3: Client detail page**

```tsx
// src/app/clients/[id]/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contracts: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{client.name}</h1>
      <p className="text-slate-600">{client.contactInfo}</p>
      <h2 className="text-lg font-medium">Historique des contrats</h2>
      <ul className="space-y-2">
        {client.contracts.map((c) => (
          <li key={c.id} className="rounded-lg border p-3">
            <Link href={`/billboards/${c.billboardId}`} className="font-medium text-blue-700">
              {c.billboard.reference}
            </Link>
            <p className="text-sm text-slate-600">
              {new Date(c.startDate).toLocaleDateString('fr-FR')} → {new Date(c.endDate).toLocaleDateString('fr-FR')} — {c.amount} MGA
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, log in, visit `/clients`. Expected: Orange Madagascar listed. Click through to detail page. Expected: shows the seeded contract linked to `ANM 001 TNR`.

- [ ] **Step 5: Commit**

```bash
git add src/app/clients src/components/clients
git commit -m "feat: add clients list and detail pages"
```

---

## Task 14: Admin dashboard with KPIs and approval queue

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/approvals/ApprovalQueue.tsx`
- Create: `src/components/layout/RoleGate.tsx`

- [ ] **Step 1: Role gate component**

```tsx
// src/components/layout/RoleGate.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function requireRole(roles: ('DEV' | 'ADMIN' | 'USER')[]) {
  const session = await auth()
  if (!session || !roles.includes(session.user.role)) {
    redirect('/map')
  }
  return session
}
```

- [ ] **Step 2: Approval queue client component**

```tsx
// src/components/approvals/ApprovalQueue.tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Approval = { id: string; type: string; requestedBy: { email: string }; createdAt: string; payload: Record<string, unknown> }

export function ApprovalQueue() {
  const [approvals, setApprovals] = useState<Approval[]>([])

  const reload = () => fetch('/api/approvals').then((r) => r.json()).then(setApprovals)
  useEffect(reload, [])

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    reload()
  }

  if (approvals.length === 0) return <p className="text-sm text-slate-500">Aucune demande en attente.</p>

  return (
    <ul className="space-y-2">
      {approvals.map((a) => (
        <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">{a.type}</p>
            <p className="text-sm text-slate-500">Demandé par {a.requestedBy.email}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(a.id, 'APPROVED')}>Approuver</Button>
            <Button size="sm" variant="outline" onClick={() => decide(a.id, 'REJECTED')}>Rejeter</Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Dashboard page with KPIs**

```tsx
// src/app/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireRole } from '@/components/layout/RoleGate'
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  await requireRole(['DEV', 'ADMIN'])

  const billboards = await prisma.billboard.findMany({ include: { contracts: true } })
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))

  const available = withStatus.filter((b) => b.status === 'AVAILABLE').length
  const rented = withStatus.filter((b) => b.status === 'RENTED' || b.status === 'EXPIRING_SOON').length
  const expiringSoon = withStatus.filter((b) => b.status === 'EXPIRING_SOON').length

  const revenueByCity = withStatus.reduce<Record<string, number>>((acc, b) => {
    const active = b.contracts.find((c) => c.status === 'ACTIVE')
    if (active) acc[b.city] = (acc[b.city] ?? 0) + active.amount
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm text-slate-500">Disponibles</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{available}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-slate-500">En location</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{rented}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-slate-500">Expirent bientôt</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{expiringSoon}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revenus par ville (contrats actifs)</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {Object.entries(revenueByCity).map(([city, amount]) => (
              <li key={city} className="flex justify-between"><span>{city}</span><span>{amount.toLocaleString('fr-FR')} MGA</span></li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Demandes d&apos;approbation</CardTitle></CardHeader>
        <CardContent><ApprovalQueue /></CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, log in as `user@rna.mg`, submit a contract edit (via devtools fetch to `/api/contracts/<seed-contract-1>` with `{"status":"TERMINATED"}`) to generate a pending approval.
Log out, log in as `admin@rna.mg`, visit `/dashboard`.
Expected: KPI cards show correct counts, revenue-by-city lists Antananarivo, and the approval queue shows the pending `EDIT_CONTRACT` request from `user@rna.mg`. Click "Approuver".
Expected: request disappears from the queue, and the seeded contract's status becomes `TERMINATED` (verify via `/billboards/<id>`).

Log in as `user@rna.mg`, visit `/dashboard`.
Expected: redirected to `/map` (role gate works).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard src/components/approvals src/components/layout/RoleGate.tsx
git commit -m "feat: add admin dashboard with KPIs and approval queue"
```

---

## Task 15: Home redirect and final polish pass

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Redirect root to /map**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/map')
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass (status, reference, billboards filter-building tests).

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Full manual regression pass**

Repeat the walkthrough from Task 12 Step 3, now including clients (Task 13) and dashboard/approvals (Task 14) end to end, across all 3 seeded roles (`dev@rna.mg`, `admin@rna.mg`, `user@rna.mg`).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redirect root path to the map view"
```

---

## Spec Coverage Checklist

- Carte interactive Madagascar, plan/satellite toggle, zoom → Task 10, 11 (`BillboardMap`)
- Ajout panneau par clic droit / bouton → Task 11 (`BillboardForm`, `map/full`)
- Fiche panneau détaillée (photo, statut, historique, dimensions, référence) → Task 6, 9, 11
- Référencement unique auto-généré → Task 3, 6
- CRM clients → Task 7, 13
- Contrats, notifications in-app (statuts dérivés `EXPIRING_SOON`/`EXPIRED`) → Task 3, 6, 14
- Filtres statut/ville/dimension/endommagé → Task 6, 10, 11
- Suivi entretien + historique par panneau → Task 7 (maintenance API), 11 (`MaintenancePanel`)
- Rôles dev/admin/user + workflow d'approbation → Task 4, 6, 7, 8, 14
- Export PDF fiche panneau → Task 9
- Dashboard KPIs (revenus par ville, alertes) → Task 14
- Split-screen / carte plein écran / BD plein écran (3 vues distinctes) → Task 10, 11
