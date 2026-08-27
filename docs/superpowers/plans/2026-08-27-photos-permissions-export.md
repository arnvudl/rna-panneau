# Multi-photo, Permissions USER, Export PDF du parc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-photo support per billboard, tighten USER permissions so they can only add (never modify/delete without approval), and add a park-wide PDF export with summary/full modes.

**Architecture:** New `BillboardPhoto` model replaces the single `currentPhotoUrl` field. File uploads stored in a Docker volume (`UPLOADS_DIR`), served via an API route. All USER PATCH/DELETE operations now create `ApprovalRequest` records instead of executing directly. A new `/api/billboards/pdf` endpoint generates a park-wide PDF in two modes using `@react-pdf/renderer`.

**Tech Stack:** Next.js 14, Prisma 7, Zod, React-PDF, Tailwind/shadcn, Vitest

---

## File Map

### New files
- `prisma/migrations/<timestamp>_add_billboard_photos/migration.sql` — migration for BillboardPhoto table + drop currentPhotoUrl
- `src/app/api/billboards/[id]/photos/route.ts` — POST (upload) + GET (list)
- `src/app/api/billboards/[id]/photos/[photoId]/route.ts` — DELETE
- `src/app/api/uploads/[filename]/route.ts` — serve uploaded files
- `src/components/billboard/PhotoGallery.tsx` — gallery UI with upload + delete
- `src/app/api/billboards/pdf/route.ts` — park-wide PDF export
- `src/components/billboard/ParkSummaryPdf.tsx` — summary table PDF
- `src/components/billboard/ParkFullPdf.tsx` — full detail PDF (one page per billboard)
- `src/components/billboard/ExportParkPdfButton.tsx` — dropdown button for park export

### Modified files
- `prisma/schema.prisma` — add BillboardPhoto model, add 3 ApprovalTypes, add photos relation to Billboard, remove currentPhotoUrl
- `src/app/api/billboards/[id]/route.ts` — USER PATCH → approval instead of direct
- `src/app/api/billboards/route.ts` — allow USER to POST (create billboards)
- `src/app/api/clients/route.ts` — unchanged (USER stays 403 for client creation)
- `src/app/api/clients/[id]/route.ts` — USER PATCH → approval instead of 403
- `src/app/api/approvals/[id]/route.ts` — handle 3 new ApprovalTypes in applyApproval
- `src/app/api/approvals/route.ts` — resolve photoId names in attachResolvedNames
- `src/components/approvals/ApprovalQueue.tsx` — add labels for new payload fields
- `src/app/billboards/[id]/page.tsx` — replace single image with PhotoGallery, include photos
- `src/components/billboard/BillboardPdfDocument.tsx` — use photos relation instead of currentPhotoUrl
- `src/app/api/billboards/[id]/pdf/route.ts` — include photos, pass first photo URL
- `src/components/billboard/BillboardDetailActions.tsx` — show edit button for USER too (triggers approval)
- `src/components/billboard/StatusOverrideControl.tsx` — show for USER too (triggers approval)
- `src/components/billboard/BillboardForm.tsx` — handle 202 response (approval created)
- `src/app/billboards/page.tsx` — add ExportParkPdfButton
- `docker-compose.yml` — add uploads volume mount
- `prisma/seed.ts` — remove currentPhotoUrl references

---

### Task 1: Schema migration — BillboardPhoto model + new ApprovalTypes

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration SQL (via prisma migrate)
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, add the `BillboardPhoto` model and update `Billboard` and `ApprovalType`:

```prisma
enum ApprovalType {
  CREATE_OCCUPANCY
  EDIT_OCCUPANCY
  DELETE_BILLBOARD
  DELETE_CLIENT
  EDIT_BILLBOARD
  EDIT_CLIENT
  DELETE_PHOTO
}

model BillboardPhoto {
  id          String   @id @default(cuid())
  billboardId String
  filename    String   @unique
  createdAt   DateTime @default(now())

  billboard Billboard @relation(fields: [billboardId], references: [id], onDelete: Cascade)

  @@index([billboardId])
}
```

In the `Billboard` model:
- Remove the line `currentPhotoUrl String?`
- Add the line `photos BillboardPhoto[]`

- [ ] **Step 2: Generate the migration**

Run inside the Docker container:

```bash
docker compose exec app npx prisma migrate dev --name add_billboard_photos
```

If that fails non-interactively (Prisma detects data loss from dropping `currentPhotoUrl`), create the migration manually:

```bash
docker compose exec app npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_add_billboard_photos/migration.sql
```

The SQL should contain:
```sql
-- CreateEnum value additions
ALTER TYPE "ApprovalType" ADD VALUE 'EDIT_BILLBOARD';
ALTER TYPE "ApprovalType" ADD VALUE 'EDIT_CLIENT';
ALTER TYPE "ApprovalType" ADD VALUE 'DELETE_PHOTO';

-- CreateTable
CREATE TABLE "BillboardPhoto" (
    "id" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillboardPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillboardPhoto_filename_key" ON "BillboardPhoto"("filename");
CREATE INDEX "BillboardPhoto_billboardId_idx" ON "BillboardPhoto"("billboardId");
ALTER TABLE "BillboardPhoto" ADD CONSTRAINT "BillboardPhoto_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropColumn
ALTER TABLE "Billboard" DROP COLUMN "currentPhotoUrl";
```

Apply and resolve if done manually:
```bash
docker compose exec app npx prisma migrate resolve --applied <migration_folder_name>
```

- [ ] **Step 3: Update seed.ts — remove currentPhotoUrl**

In `prisma/seed.ts`, if there is any reference to `currentPhotoUrl` in the billboard upsert, remove that field from the data object.

- [ ] **Step 4: Generate Prisma client and verify**

```bash
docker compose exec app npx prisma generate
docker compose exec app npx tsc --noEmit
```

Expected: TypeScript errors in files that reference `currentPhotoUrl` — that's fine, they'll be fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ prisma/seed.ts
git commit -m "feat: add BillboardPhoto model, new ApprovalTypes, drop currentPhotoUrl"
```

---

### Task 2: Docker uploads volume + file serving API

**Files:**
- Modify: `docker-compose.yml`
- Create: `src/app/api/uploads/[filename]/route.ts`

- [ ] **Step 1: Add uploads volume to docker-compose.yml**

In `docker-compose.yml`, add a named volume and mount it in the `app` service:

```yaml
  app:
    # ... existing config ...
    volumes:
      - .:/app
      - app_node_modules:/app/node_modules
      - app_next:/app/.next
      - app_uploads:/app/uploads

volumes:
  db_data:
  app_node_modules:
  app_next:
  app_uploads:
```

- [ ] **Step 2: Create the file serving API route**

Create `src/app/api/uploads/[filename]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/api-helpers'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const filename = params.filename
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const ext = path.extname(filename).toLowerCase()
  const mimeType = MIME_TYPES[ext]
  if (!mimeType) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })

  try {
    const filePath = path.join(UPLOADS_DIR, 'photos', filename)
    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml src/app/api/uploads/
git commit -m "feat: add uploads volume and file serving API route"
```

---

### Task 3: Photo upload + delete API routes

**Files:**
- Create: `src/app/api/billboards/[id]/photos/route.ts`
- Create: `src/app/api/billboards/[id]/photos/[photoId]/route.ts`

- [ ] **Step 1: Create the upload route**

Create `src/app/api/billboards/[id]/photos/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { createId } from '@paralleldrive/cuid2'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const photos = await prisma.billboardPhoto.findMany({
    where: { billboardId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(photos)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({ where: { id: params.id } })
  if (!billboard) return NextResponse.json({ error: 'Billboard not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const ext = file.type === 'image/jpeg' ? '.jpg'
    : file.type === 'image/png' ? '.png'
    : file.type === 'image/webp' ? '.webp'
    : '.gif'
  const filename = `${createId()}${ext}`

  const dir = path.join(UPLOADS_DIR, 'photos')
  await mkdir(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, filename), buffer)

  const photo = await prisma.billboardPhoto.create({
    data: { billboardId: params.id, filename },
  })
  return NextResponse.json(photo, { status: 201 })
}
```

- [ ] **Step 2: Check if @paralleldrive/cuid2 is available**

```bash
docker compose exec app node -e "require('@paralleldrive/cuid2')"
```

If it fails, the project already uses Prisma's `cuid()` which is from `@prisma/client`. Instead, use Node crypto:

Replace `import { createId } from '@paralleldrive/cuid2'` with:
```typescript
import { randomBytes } from 'crypto'
function createId() {
  return randomBytes(16).toString('hex')
}
```

- [ ] **Step 3: Create the delete route**

Create `src/app/api/billboards/[id]/photos/[photoId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireSession, createApprovalRequest } from '@/lib/api-helpers'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const { session, error } = await requireSession()
  if (error) return error

  const photo = await prisma.billboardPhoto.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.billboardId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'DELETE_PHOTO', {
      photoId: params.photoId,
      billboardId: params.id,
    })
  }

  const filePath = path.join(UPLOADS_DIR, 'photos', photo.filename)
  await unlink(filePath).catch(() => {})
  await prisma.billboardPhoto.delete({ where: { id: params.photoId } })
  return NextResponse.json({ status: 'deleted' })
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billboards/\[id\]/photos/
git commit -m "feat: add photo upload and delete API routes"
```

---

### Task 4: USER permission tightening — billboard routes

**Files:**
- Modify: `src/app/api/billboards/route.ts`
- Modify: `src/app/api/billboards/[id]/route.ts`

- [ ] **Step 1: Allow USER to create billboards**

In `src/app/api/billboards/route.ts`, remove the USER block in the POST handler. Delete these lines (around lines 42-44):

```typescript
  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 2: Route all USER PATCH requests through approval**

In `src/app/api/billboards/[id]/route.ts`, replace the current PATCH handler logic. The current code only blocks USER for `RESTRICTED_FIELDS` and lets `damaged`/`note`/`currentPhotoUrl` through directly. Change it so ALL fields go through approval for USER.

Replace the PATCH function body (lines 51-69) with:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'EDIT_BILLBOARD', {
      billboardId: params.id,
      ...parsed.data,
    })
  }

  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(billboard)
}
```

Also add `createApprovalRequest` to the imports at line 5:

```typescript
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
```

Remove the `RESTRICTED_FIELDS` constant (lines 40-49) — it's no longer needed since all USER edits go through approval.

Also remove `currentPhotoUrl` from the `patchSchema` since that field no longer exists on Billboard:

```typescript
const patchSchema = z.object({
  damaged: z.boolean().optional(),
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
```

- [ ] **Step 3: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billboards/route.ts src/app/api/billboards/\[id\]/route.ts
git commit -m "feat: USER can create billboards, all USER edits go through approval"
```

---

### Task 5: USER permission tightening — client routes

**Files:**
- Modify: `src/app/api/clients/[id]/route.ts`

- [ ] **Step 1: Route USER PATCH to approval instead of 403**

In `src/app/api/clients/[id]/route.ts`, change the PATCH handler. Replace line 27:

```typescript
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

With:

```typescript
  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'EDIT_CLIENT', {
      clientId: params.id,
      ...parsed.data,
    })
  }
```

Note: the `parsed` variable must be computed BEFORE this check. Move the parse call above the role check. The full PATCH function becomes:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'EDIT_CLIENT', {
      clientId: params.id,
      ...parsed.data,
    })
  }

  const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(client)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clients/\[id\]/route.ts
git commit -m "feat: USER client PATCH goes through approval instead of 403"
```

---

### Task 6: Handle new ApprovalTypes in applyApproval + approval queue UI

**Files:**
- Modify: `src/app/api/approvals/[id]/route.ts`
- Modify: `src/app/api/approvals/route.ts`
- Modify: `src/components/approvals/ApprovalQueue.tsx`

- [ ] **Step 1: Add cases to applyApproval**

In `src/app/api/approvals/[id]/route.ts`, add three new cases to the `applyApproval` switch (before the `default` case):

```typescript
    case 'EDIT_BILLBOARD': {
      const { billboardId, ...fields } = data
      await tx.billboard.update({
        where: { id: billboardId as string },
        data: fields as Record<string, unknown>,
      })
      break
    }
    case 'EDIT_CLIENT': {
      const { clientId, ...fields } = data
      await tx.client.update({
        where: { id: clientId as string },
        data: fields as Record<string, unknown>,
      })
      break
    }
    case 'DELETE_PHOTO': {
      const photo = await tx.billboardPhoto.findUnique({
        where: { id: data.photoId as string },
      })
      if (photo) {
        const { unlink } = await import('fs/promises')
        const path = await import('path')
        const uploadsDir = process.env.UPLOADS_DIR ?? './uploads'
        await unlink(path.join(uploadsDir, 'photos', photo.filename)).catch(() => {})
        await tx.billboardPhoto.delete({ where: { id: data.photoId as string } })
      }
      break
    }
```

- [ ] **Step 2: Add photoId resolution in attachResolvedNames**

In `src/app/api/approvals/route.ts`, add `photoId` to the collection and resolution logic.

After the existing ID collection loop (around line 31), add:

```typescript
  const photoIds = new Set<string>()
```

Inside the `for` loop, add:
```typescript
    if (typeof data.photoId === 'string') photoIds.add(data.photoId)
```

In the Promise.all block, add a fourth query:

```typescript
    photoIds.size
      ? prisma.billboardPhoto.findMany({
          where: { id: { in: Array.from(photoIds) } },
          select: { id: true, filename: true, billboard: { select: { reference: true } } },
        })
      : Promise.resolve([]),
```

Destructure it: `const [billboards, clients, occupancies, photos] = await Promise.all([...])`.

Add a map:
```typescript
  const photoMap = new Map(photos.map((p) => [p.id, `${p.billboard.reference} — ${p.filename}`]))
```

In the return mapping, add:
```typescript
    if (typeof data.photoId === 'string') {
      const name = photoMap.get(data.photoId)
      if (name) resolvedNames.photoId = name
    }
```

- [ ] **Step 3: Update ApprovalQueue payload labels**

In `src/components/approvals/ApprovalQueue.tsx`, add entries to `PAYLOAD_LABELS`:

```typescript
const PAYLOAD_LABELS: Record<string, string> = {
  billboardId: 'Panneau',
  clientId: 'Client',
  occupancyId: 'Contrat',
  photoId: 'Photo',
  face: 'Face',
  contractRef: 'Référence du contrat',
  startDate: 'Début',
  endDate: 'Fin',
  status: 'Statut',
  damaged: 'Endommagé',
  note: 'Note',
  city: 'Ville',
  dimension: 'Dimension',
  sides: 'Faces',
  statusOverride: 'Forçage statut',
  lat: 'Latitude',
  lng: 'Longitude',
  permitNumber: 'Autorisation',
  taxPaymentRef: 'Réf. taxe',
  name: 'Nom',
  phone: 'Téléphone',
  email: 'Email',
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/approvals/ src/components/approvals/ApprovalQueue.tsx
git commit -m "feat: handle EDIT_BILLBOARD, EDIT_CLIENT, DELETE_PHOTO approvals"
```

---

### Task 7: PhotoGallery component + billboard detail page

**Files:**
- Create: `src/components/billboard/PhotoGallery.tsx`
- Modify: `src/app/billboards/[id]/page.tsx`

- [ ] **Step 1: Create the PhotoGallery component**

Create `src/components/billboard/PhotoGallery.tsx`:

```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageOff, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Photo = { id: string; filename: string; createdAt: string }

export function PhotoGallery({
  billboardId,
  photos,
}: {
  billboardId: string
  photos: Photo[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/billboards/${billboardId}/photos`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (photoId: string) => {
    setDeletingId(photoId)
    setError(null)
    try {
      const res = await fetch(`/api/billboards/${billboardId}/photos/${photoId}`, {
        method: 'DELETE',
      })
      if (res.status === 202) {
        setError('Demande de suppression envoyée pour approbation')
      } else if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  if (photos.length === 0 && !uploading) {
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-slate-50 text-slate-400">
          <ImageOff className="h-10 w-10" />
          <p className="text-sm font-medium">Aucune photo</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Plus className="mr-1 h-4 w-4" /> Ajouter une photo
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/uploads/${p.filename}`}
              alt=""
              className="aspect-video w-full rounded-lg border object-cover"
            />
            <button
              onClick={() => remove(p.id)}
              disabled={deletingId === p.id}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <Plus className="mr-1 h-4 w-4" /> {uploading ? 'Upload…' : 'Ajouter une photo'}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update the billboard detail page**

In `src/app/billboards/[id]/page.tsx`:

Replace the `ImageOff` import:
```typescript
import { PhotoGallery } from '@/components/billboard/PhotoGallery'
```

Remove the `ImageOff` import from lucide-react.

In the Prisma query, add `photos` to the include:
```typescript
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' } },
    },
```

Replace the entire photo section (the `<div>` containing `billboard.currentPhotoUrl` check, approximately lines 67-80) with:

```tsx
        <PhotoGallery
          billboardId={billboard.id}
          photos={billboard.photos.map((p) => ({
            id: p.id,
            filename: p.filename,
            createdAt: p.createdAt.toISOString(),
          }))}
        />
```

- [ ] **Step 3: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/billboard/PhotoGallery.tsx src/app/billboards/\[id\]/page.tsx
git commit -m "feat: replace single photo with multi-photo gallery on billboard detail"
```

---

### Task 8: Update UI components for USER approval flow

**Files:**
- Modify: `src/components/billboard/BillboardDetailActions.tsx`
- Modify: `src/components/billboard/StatusOverrideControl.tsx`
- Modify: `src/components/billboard/BillboardForm.tsx`
- Modify: `src/components/clients/ClientForm.tsx`
- Modify: `src/components/clients/ClientDetailActions.tsx`

- [ ] **Step 1: Show edit button for all roles (USER triggers approval)**

In `src/components/billboard/BillboardDetailActions.tsx`, the component currently returns `null` for USER. Change it to show the button for all authenticated users, since USER edits now go through approval:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { BillboardForm, type EditableBillboard } from '@/components/billboard/BillboardForm'

export function BillboardDetailActions({ billboard }: { billboard: EditableBillboard }) {
  const { status } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (status !== 'authenticated') return null

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Modifier
      </Button>
      <BillboardForm
        mode="edit"
        billboard={billboard}
        open={open}
        onOpenChange={setOpen}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
```

- [ ] **Step 2: Show StatusOverrideControl for all roles**

In `src/components/billboard/StatusOverrideControl.tsx`, change the guard. Replace:

```typescript
  const isAdmin = status === 'authenticated' && session?.user?.role !== 'USER'
  if (!isAdmin) return null
```

With:

```typescript
  if (status !== 'authenticated') return null
```

Remove the unused `session` from the destructuring (or keep it — no functional difference since the PATCH endpoint handles the role check).

- [ ] **Step 3: Handle 202 approval response in BillboardForm**

In `src/components/billboard/BillboardForm.tsx`, update the submit function to handle 202 (approval created) gracefully. After the fetch call (around line 91-95), replace:

```typescript
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
```

With:

```typescript
      if (res.status === 202) {
        setError('Modification envoyée pour approbation')
        onOpenChange(false)
        onSaved()
        return
      }
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
```

Note: `setError` is repurposed here for a success-like message. To be cleaner, add a `[message, setMessage]` state. But for simplicity, showing the feedback via the existing `error` state with a different color or just closing the dialog and relying on the text is fine. The dialog closes and `onSaved` refreshes the page — the user sees the page refresh.

Actually, cleaner approach — just close the dialog silently:

```typescript
      if (res.status === 202 || res.ok) {
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
        return
      }
      throw new Error(`Request failed with status ${res.status}`)
```

- [ ] **Step 4: Handle 202 in ClientForm**

In `src/components/clients/ClientForm.tsx`, apply the same 202 handling in the `submit` function. Replace:

```typescript
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
```

With:

```typescript
      if (res.status === 202 || res.ok) {
        if (mode === 'create') {
          setName('')
          setPhone('')
          setEmail('')
        }
        onOpenChange(false)
        onSaved()
        return
      }
      throw new Error(`Request failed with status ${res.status}`)
```

And remove the duplicate create-mode reset + `onOpenChange(false)` + `onSaved()` lines that follow (lines 46-51 in the original), since they're now inside the `if` block.

- [ ] **Step 5: Show client edit button for all roles**

In `src/components/clients/ClientDetailActions.tsx`, the "Modifier" button is currently gated behind `canEdit` (ADMIN/DEV only). Change it to show for all authenticated users, since USER edits now go through approval. Replace the `canEdit` guard for the edit button section to just check `status === 'authenticated'`.

- [ ] **Step 6: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/components/billboard/BillboardDetailActions.tsx src/components/billboard/StatusOverrideControl.tsx src/components/billboard/BillboardForm.tsx src/components/clients/ClientForm.tsx src/components/clients/ClientDetailActions.tsx
git commit -m "feat: show edit controls to USER (edits route through approval)"
```

---

### Task 9: Update PDF components for multi-photo

**Files:**
- Modify: `src/components/billboard/BillboardPdfDocument.tsx`
- Modify: `src/app/api/billboards/[id]/pdf/route.ts`

- [ ] **Step 1: Update BillboardPdfData type and component**

In `src/components/billboard/BillboardPdfDocument.tsx`, replace `currentPhotoUrl: string | null` with `photoUrl: string | null` in the type:

```typescript
export type BillboardPdfData = {
  reference: string
  city: string
  dimension: string
  sides: number
  status: string
  photoUrl: string | null
  permitNumber: string | null
  taxPaymentRef: string | null
  occupancies: { clientName: string; face: string; contractRef: string | null; endDate: string | null }[]
  maintenanceRecords: { date: string; type: string; comment: string | null }[]
}
```

In the component, replace `{data.currentPhotoUrl && <Image src={data.currentPhotoUrl} style={styles.photo} />}` with:

```tsx
        {data.photoUrl && <Image src={data.photoUrl} style={styles.photo} />}
```

- [ ] **Step 2: Update the individual PDF route**

In `src/app/api/billboards/[id]/pdf/route.ts`, update the include to fetch photos and pass the first photo's URL:

```typescript
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
```

In the data mapping, replace `currentPhotoUrl: billboard.currentPhotoUrl` with:

```typescript
        photoUrl: billboard.photos[0]
          ? `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/uploads/${billboard.photos[0].filename}`
          : null,
```

- [ ] **Step 3: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/billboard/BillboardPdfDocument.tsx src/app/api/billboards/\[id\]/pdf/route.ts
git commit -m "feat: update billboard PDF to use multi-photo model"
```

---

### Task 10: Park PDF export — summary mode

**Files:**
- Create: `src/components/billboard/ParkSummaryPdf.tsx`

- [ ] **Step 1: Create the summary PDF component**

Create `src/components/billboard/ParkSummaryPdf.tsx`:

```typescript
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica', orientation: 'landscape' },
  title: { fontSize: 16, marginBottom: 8, color: '#1e3a8a' },
  subtitle: { fontSize: 10, marginBottom: 12, color: '#64748b' },
  table: { width: '100%' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottom: '1 solid #cbd5e1', paddingVertical: 4 },
  row: { flexDirection: 'row', borderBottom: '0.5 solid #e2e8f0', paddingVertical: 3 },
  cell: { paddingHorizontal: 4 },
  colRef: { width: '12%' },
  colCity: { width: '14%' },
  colDim: { width: '10%' },
  colSides: { width: '7%' },
  colStatus: { width: '12%' },
  colClient: { width: '18%' },
  colPermit: { width: '12%' },
  colTax: { width: '15%' },
  headerText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' },
})

export type ParkSummaryRow = {
  reference: string
  city: string
  dimension: string
  sides: number
  status: string
  activeClients: string
  permitNumber: string | null
  taxPaymentRef: string | null
}

export function ParkSummaryPdf({ rows, generatedAt }: { rows: ParkSummaryRow[]; generatedAt: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Parc de panneaux — Récapitulatif</Text>
        <Text style={styles.subtitle}>{rows.length} panneaux — généré le {generatedAt}</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={[styles.cell, styles.colRef]}><Text style={styles.headerText}>Identifiant</Text></View>
            <View style={[styles.cell, styles.colCity]}><Text style={styles.headerText}>Ville</Text></View>
            <View style={[styles.cell, styles.colDim]}><Text style={styles.headerText}>Dimension</Text></View>
            <View style={[styles.cell, styles.colSides]}><Text style={styles.headerText}>Faces</Text></View>
            <View style={[styles.cell, styles.colStatus]}><Text style={styles.headerText}>Statut</Text></View>
            <View style={[styles.cell, styles.colClient]}><Text style={styles.headerText}>Client(s)</Text></View>
            <View style={[styles.cell, styles.colPermit]}><Text style={styles.headerText}>Autorisation</Text></View>
            <View style={[styles.cell, styles.colTax]}><Text style={styles.headerText}>Taxe</Text></View>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={[styles.cell, styles.colRef]}><Text>{r.reference}</Text></View>
              <View style={[styles.cell, styles.colCity]}><Text>{r.city}</Text></View>
              <View style={[styles.cell, styles.colDim]}><Text>{r.dimension}</Text></View>
              <View style={[styles.cell, styles.colSides]}><Text>{r.sides}</Text></View>
              <View style={[styles.cell, styles.colStatus]}><Text>{r.status}</Text></View>
              <View style={[styles.cell, styles.colClient]}><Text>{r.activeClients || '—'}</Text></View>
              <View style={[styles.cell, styles.colPermit]}><Text>{r.permitNumber ?? '—'}</Text></View>
              <View style={[styles.cell, styles.colTax]}><Text>{r.taxPaymentRef ?? 'Non payée'}</Text></View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/billboard/ParkSummaryPdf.tsx
git commit -m "feat: add ParkSummaryPdf component for park export"
```

---

### Task 11: Park PDF export — full mode

**Files:**
- Create: `src/components/billboard/ParkFullPdf.tsx`

- [ ] **Step 1: Create the full PDF component**

Create `src/components/billboard/ParkFullPdf.tsx`:

```typescript
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 12, color: '#1e3a8a' },
  section: { marginBottom: 16 },
  label: { color: '#64748b', fontSize: 9 },
  photo: { width: '100%', height: 200, objectFit: 'cover', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 14, marginBottom: 8, color: '#1e3a8a' },
})

export type ParkFullBillboard = {
  reference: string
  city: string
  dimension: string
  sides: number
  status: string
  photoUrl: string | null
  permitNumber: string | null
  taxPaymentRef: string | null
  occupancies: { clientName: string; face: string; contractRef: string | null; endDate: string | null }[]
  maintenanceRecords: { date: string; type: string; comment: string | null }[]
}

export function ParkFullPdf({
  billboards,
  generatedAt,
}: {
  billboards: ParkFullBillboard[]
  generatedAt: string
}) {
  return (
    <Document>
      {billboards.map((data, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <Text style={styles.title}>{data.reference}</Text>
          {data.photoUrl && <Image src={data.photoUrl} style={styles.photo} />}

          <View style={styles.section}>
            <View style={styles.row}><Text style={styles.label}>Ville</Text><Text>{data.city}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Dimensions</Text><Text>{data.dimension}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Faces</Text><Text>{data.sides}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Statut</Text><Text>{data.status}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Autorisation</Text><Text>{data.permitNumber ?? '—'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Taxe communale</Text><Text>{data.taxPaymentRef ?? 'Non payée'}</Text></View>
          </View>

          {data.occupancies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contrats</Text>
              {data.occupancies.map((o, j) => (
                <View key={j} style={styles.row}>
                  <Text>{o.face} — {o.clientName}</Text>
                  <Text>{o.contractRef ?? 'Sans référence'}{o.endDate ? ` (jusqu'au ${o.endDate})` : ''}</Text>
                </View>
              ))}
            </View>
          )}

          {data.maintenanceRecords.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Entretien</Text>
              {data.maintenanceRecords.map((m, j) => (
                <View key={j} style={styles.row}>
                  <Text>{m.date} — {m.type}</Text>
                  <Text>{m.comment ?? ''}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={{ position: 'absolute', bottom: 16, right: 32, fontSize: 8, color: '#94a3b8' }}>
            Généré le {generatedAt} — {i + 1}/{billboards.length}
          </Text>
        </Page>
      ))}
    </Document>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/billboard/ParkFullPdf.tsx
git commit -m "feat: add ParkFullPdf component for detailed park export"
```

---

### Task 12: Park PDF API route

**Files:**
- Create: `src/app/api/billboards/pdf/route.ts`

- [ ] **Step 1: Create the park PDF endpoint**

Create `src/app/api/billboards/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { STATUS_LABELS } from '@/lib/status-labels'
import { buildBillboardWhere } from '../where'
import { requireSession } from '@/lib/api-helpers'
import { ParkSummaryPdf, type ParkSummaryRow } from '@/components/billboard/ParkSummaryPdf'
import { ParkFullPdf, type ParkFullBillboard } from '@/components/billboard/ParkFullPdf'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const mode = req.nextUrl.searchParams.get('mode') ?? 'summary'
  if (mode !== 'summary' && mode !== 'full') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const where = buildBillboardWhere(req.nextUrl.searchParams)
  const billboards = await prisma.billboard.findMany({
    where,
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { reference: 'asc' },
  })

  const statusFilter = req.nextUrl.searchParams.get('status')
  const withStatus = billboards.map((b) => ({ ...b, computedStatus: deriveBillboardStatus(b) }))
  const filtered = statusFilter ? withStatus.filter((b) => b.computedStatus === statusFilter) : withStatus

  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  let buffer: Buffer

  if (mode === 'summary') {
    const rows: ParkSummaryRow[] = filtered.map((b) => ({
      reference: b.reference,
      city: b.city,
      dimension: b.dimension,
      sides: b.sides,
      status: STATUS_LABELS[b.computedStatus as keyof typeof STATUS_LABELS] ?? b.computedStatus,
      activeClients: b.occupancies
        .filter((o) => o.status === 'ACTIVE')
        .map((o) => o.client.name)
        .join(', '),
      permitNumber: b.permitNumber,
      taxPaymentRef: b.taxPaymentRef,
    }))
    buffer = await renderToBuffer(ParkSummaryPdf({ rows, generatedAt }))
  } else {
    const data: ParkFullBillboard[] = filtered.map((b) => ({
      reference: b.reference,
      city: b.city,
      dimension: b.dimension,
      sides: b.sides,
      status: STATUS_LABELS[b.computedStatus as keyof typeof STATUS_LABELS] ?? b.computedStatus,
      photoUrl: b.photos[0] ? `${baseUrl}/api/uploads/${b.photos[0].filename}` : null,
      permitNumber: b.permitNumber,
      taxPaymentRef: b.taxPaymentRef,
      occupancies: b.occupancies.map((o) => ({
        clientName: o.client.name,
        face: o.face,
        contractRef: o.contractRef,
        endDate: o.endDate ? o.endDate.toLocaleDateString('fr-FR') : null,
      })),
      maintenanceRecords: b.maintenanceRecords.map((m) => ({
        date: m.date.toLocaleDateString('fr-FR'),
        type: m.type,
        comment: m.comment,
      })),
    }))
    buffer = await renderToBuffer(ParkFullPdf({ billboards: data, generatedAt }))
  }

  const filename = mode === 'summary' ? 'parc-panneaux-recap.pdf' : 'parc-panneaux-detail.pdf'
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billboards/pdf/
git commit -m "feat: add park-wide PDF export endpoint (summary + full modes)"
```

---

### Task 13: Export park PDF button on billboards page

**Files:**
- Create: `src/components/billboard/ExportParkPdfButton.tsx`
- Modify: `src/app/billboards/page.tsx` (need to find actual location — may be in a layout or a client component)

- [ ] **Step 1: Create the export button with dropdown**

Create `src/components/billboard/ExportParkPdfButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown } from 'lucide-react'

export function ExportParkPdfButton({ filters }: { filters: Record<string, string | undefined> }) {
  const [open, setOpen] = useState(false)

  const exportPdf = (mode: 'summary' | 'full') => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries({ ...filters, mode }).filter(([, v]) => v !== undefined)
      ) as Record<string, string>
    )
    window.open(`/api/billboards/pdf?${params}`, '_blank')
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <FileDown className="mr-1 h-4 w-4" /> Exporter PDF
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-white py-1 shadow-lg">
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => exportPdf('summary')}
            >
              Récapitulatif (tableau)
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => exportPdf('full')}
            >
              Détaillé (une page par panneau)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the button to the billboards page**

The billboards list page needs to be located. It's likely at `src/app/billboards/page.tsx` — which returned "file does not exist" earlier. Check where the list page lives:

```bash
find src -name "*.tsx" | xargs grep -l "useBillboards\|BillboardTable" | head -10
```

Wherever the billboards list is rendered (the component that uses `FilterBar` + `BillboardTable`), add the `ExportParkPdfButton` next to the filter bar. Import it and pass the current `filters` state:

```tsx
import { ExportParkPdfButton } from '@/components/billboard/ExportParkPdfButton'

// Inside the component's JSX, in the filter bar area:
<div className="flex items-center justify-between border-b bg-white px-4 py-3">
  <FilterBar filters={filters} onChange={setFilters} />
  <ExportParkPdfButton filters={filters} />
</div>
```

The exact placement depends on the page structure. The button should sit at the end of the filter bar row.

- [ ] **Step 3: Verify TypeScript**

```bash
docker compose exec app npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/billboard/ExportParkPdfButton.tsx src/app/
git commit -m "feat: add export park PDF button with summary/full mode dropdown"
```

---

### Task 14: Run tests + final verification

**Files:** None (verification only)

- [ ] **Step 1: Run the test suite**

```bash
docker compose exec app npx vitest run
```

Expected: all existing tests pass. The `buildBillboardWhere` tests, `face-occupancy` tests, `reference` tests, and `status` tests should all still pass.

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec app npx tsc --noEmit
```

Expected: clean, no errors.

- [ ] **Step 3: Verify no stale references to currentPhotoUrl**

```bash
grep -r "currentPhotoUrl" src/ prisma/schema.prisma prisma/seed.ts
```

Expected: zero matches.

- [ ] **Step 4: Verify no stale references to RESTRICTED_FIELDS**

```bash
grep -r "RESTRICTED_FIELDS" src/
```

Expected: zero matches.

- [ ] **Step 5: Quick API smoke tests**

```bash
# Test photo upload (as admin)
docker compose exec app sh -c 'echo "test" > /tmp/test.jpg'
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -F "file=@/tmp/test.jpg;type=image/jpeg" \
  -b "next-auth.session-token=<admin-session>" \
  http://localhost:3000/api/billboards/<billboard-id>/photos

# Test USER creating a billboard (should work now)
curl -s -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=<user-session>" \
  -d '{"lat":-18.9,"lng":47.5,"city":"Test","dimension":"D4X3","sides":1}' \
  http://localhost:3000/api/billboards

# Test USER editing a billboard (should get 202)
curl -s -w "%{http_code}" -X PATCH \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=<user-session>" \
  -d '{"damaged":true}' \
  http://localhost:3000/api/billboards/<billboard-id>

# Test park PDF export
curl -s -o /dev/null -w "%{http_code}" \
  -b "next-auth.session-token=<admin-session>" \
  "http://localhost:3000/api/billboards/pdf?mode=summary"
```

- [ ] **Step 6: Clean up test data**

Delete any test billboards/photos created during verification via psql.
