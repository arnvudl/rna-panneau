# Référence panneau par Région/District Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le champ `city` (texte libre) et la table `CityPrefix` par une détection automatique du district (puis de la région, dérivée) et de la commune d'un panneau à partir de ses coordonnées GPS, et générer sa référence sous la forme `CODE_REGION-0000`.

**Architecture:** Trois nouvelles tables (`Region` — 23 lignes fixes, `District` — 119 lignes seedées depuis geoBoundaries ADM2, `Commune` — seedée depuis ADM3). Un service serveur (`geo-lookup.ts`) fait une recherche point-dans-polygone sur des fichiers GeoJSON simplifiés stockés dans le dépôt. La migration se fait en deux phases : ajout des nouvelles colonnes en parallèle de `city` (nullable), backfill des panneaux existants, puis suppression de `city`/`CityPrefix` et passage des nouvelles colonnes en NOT NULL.

**Tech Stack:** Next.js 14 (API routes), Prisma/PostgreSQL, `@turf/boolean-point-in-polygon` + `@turf/helpers` + `@turf/simplify`, données geoBoundaries (CC-BY 3.0 IGO), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-region-district-naming-design.md`

---

## Vue d'ensemble des fichiers

- `prisma/schema.prisma` — modèles `Region`/`District`/`Commune`, champs `Billboard`
- `prisma/geo-data/mdg-adm1.geojson`, `mdg-adm2-simplified.geojson`, `mdg-adm3-simplified.geojson` — données géographiques, générées une fois par `scripts/prepare-geo-data.ts`
- `scripts/prepare-geo-data.ts` — télécharge et simplifie les frontières geoBoundaries (exécuté une fois par le développeur)
- `prisma/seed-geo.ts` — seed des régions/districts/communes à partir des fichiers GeoJSON
- `src/lib/geo-lookup.ts` — recherche point-dans-polygone bas niveau (district/commune par nom)
- `src/lib/billboard-geo.ts` — résolution haut niveau (nom → ids Prisma région/district/commune)
- `src/lib/reference.ts` — génération de la référence (réécrit)
- `src/app/api/billboards/route.ts`, `src/app/api/billboards/[id]/route.ts`, `src/app/api/billboards/where.ts` — API panneaux
- `src/app/api/regions/route.ts`, `src/app/api/districts/route.ts` — nouvelles routes de lecture
- `src/app/api/approvals/[id]/route.ts` — payload `EDIT_BILLBOARD`
- `src/components/billboard/BillboardForm.tsx`, `src/components/table/FilterBar.tsx`, `src/components/table/BillboardTable.tsx`, `src/components/billboard/BillboardDrawer.tsx` — UI
- `src/components/billboard/ParkFullPdf.tsx`, `ParkSummaryPdf.tsx`, `BillboardPdfDocument.tsx`, `src/app/api/billboards/pdf/route.ts` — export PDF
- `src/app/settings/regions/page.tsx` (nouveau, remplace `src/app/settings/city-prefixes/page.tsx`)
- `scripts/migrate-billboard-geo.ts` — backfill des panneaux existants
- `prisma/seed.ts` — données d'exemple mises à jour

---

### Task 1: Ajouter les dépendances géo

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installer les paquets turf**

```bash
npm install @turf/boolean-point-in-polygon @turf/helpers @turf/simplify
npm install --save-dev @types/geojson
```

- [ ] **Step 2: Vérifier l'installation**

Run: `node -e "require('@turf/boolean-point-in-polygon'); require('@turf/helpers'); require('@turf/simplify'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add turf dependencies for geo point-in-polygon lookup"
```

---

### Task 2: Schéma Prisma — phase 1 (ajout, sans suppression)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Ajouter les modèles Region/District/Commune et les champs Billboard**

Dans `prisma/schema.prisma`, ajouter après le modèle `Client` (avant `Occupancy`) :

```prisma
model Region {
  id         String     @id @default(cuid())
  name       String     @unique
  code       String     @unique
  districts  District[]
  billboards Billboard[]
}

model District {
  id         String      @id @default(cuid())
  name       String
  regionId   String
  region     Region      @relation(fields: [regionId], references: [id])
  communes   Commune[]
  billboards Billboard[]

  @@unique([regionId, name])
  @@index([regionId])
}

model Commune {
  id         String      @id @default(cuid())
  name       String
  districtId String
  district   District    @relation(fields: [districtId], references: [id])
  billboards Billboard[]

  @@unique([districtId, name])
  @@index([districtId])
}
```

Modifier le modèle `Billboard` : rendre `city` nullable, ajouter les nouveaux champs optionnels (ils deviendront obligatoires en phase 2) :

```prisma
model Billboard {
  id              String    @id @default(cuid())
  reference       String    @unique
  lat             Float
  lng             Float
  city            String?
  regionId        String?
  districtId      String?
  communeId       String?
  dimension       Dimension
  sides           Int       @default(1)
  damaged         Boolean   @default(false)
  note            String?
  permitNumber    String?
  taxPaymentRef   String?
  statusOverride  BillboardStatus?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  region             Region?              @relation(fields: [regionId], references: [id])
  district           District?            @relation(fields: [districtId], references: [id])
  commune            Commune?             @relation(fields: [communeId], references: [id])
  photos             BillboardPhoto[]
  occupancies        Occupancy[]
  maintenanceRecords MaintenanceRecord[]

  @@index([regionId])
  @@index([districtId])
  @@index([communeId])
}
```

- [ ] **Step 2: Générer la migration**

```bash
npx prisma migrate dev --name add_region_district_commune
```

Expected: migration créée et appliquée sans erreur (les colonnes ajoutées sont nullable, `city` passe de `String` à `String?` — pas de perte de données).

- [ ] **Step 3: Vérifier que le client Prisma expose les nouveaux modèles**

Run: `node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); console.log(typeof p.region.findMany, typeof p.district.findMany, typeof p.commune.findMany)"`
Expected: `function function function`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Region/District/Commune models, nullable geo fields on Billboard"
```

---

### Task 3: Préparer les données géographiques

**Files:**
- Create: `scripts/prepare-geo-data.ts`
- Create (généré par le script, à committer) : `prisma/geo-data/mdg-adm1.geojson`, `prisma/geo-data/mdg-adm2-simplified.geojson`, `prisma/geo-data/mdg-adm3-simplified.geojson`

- [ ] **Step 1: Écrire le script de téléchargement/simplification**

```typescript
// scripts/prepare-geo-data.ts
import fs from 'fs'
import path from 'path'
// @ts-expect-error -- @turf/simplify has no bundled types matching this call shape
import simplify from '@turf/simplify'

const COMMIT = '9469f09592ced973a3448cf66b6100b741b64c0d'
const BASE_URL = `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/${COMMIT}/releaseData/gbOpen/MDG`
const OUT_DIR = path.join(process.cwd(), 'prisma', 'geo-data')

async function download(level: string): Promise<GeoJSON.FeatureCollection> {
  const url = `${BASE_URL}/${level}/geoBoundaries-MDG-${level}.geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${level}: ${res.status}`)
  return res.json()
}

function report(file: string) {
  const stats = fs.statSync(path.join(OUT_DIR, file))
  console.log(`${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const adm1 = await download('ADM1')
  fs.writeFileSync(path.join(OUT_DIR, 'mdg-adm1.geojson'), JSON.stringify(adm1))
  console.log(`ADM1: ${adm1.features.length} regions`)

  const adm2 = await download('ADM2')
  console.log(`ADM2: ${adm2.features.length} districts`)
  const adm2Simplified = simplify(adm2, { tolerance: 0.005, highQuality: false })
  fs.writeFileSync(path.join(OUT_DIR, 'mdg-adm2-simplified.geojson'), JSON.stringify(adm2Simplified))

  const adm3 = await download('ADM3')
  console.log(`ADM3: ${adm3.features.length} communes`)
  const adm3Simplified = simplify(adm3, { tolerance: 0.005, highQuality: false })
  fs.writeFileSync(path.join(OUT_DIR, 'mdg-adm3-simplified.geojson'), JSON.stringify(adm3Simplified))

  report('mdg-adm1.geojson')
  report('mdg-adm2-simplified.geojson')
  report('mdg-adm3-simplified.geojson')
}

main()
```

- [ ] **Step 2: Exécuter le script**

```bash
npx tsx scripts/prepare-geo-data.ts
```

Expected: trois fichiers écrits dans `prisma/geo-data/`, tailles affichées en Mo.

- [ ] **Step 3: Vérifier la taille des fichiers**

Si `mdg-adm3-simplified.geojson` dépasse 40 Mo, augmenter `tolerance` (ex: `0.01`) dans le script et relancer l'étape 2 jusqu'à obtenir un fichier raisonnable (idéalement < 20 Mo) — GitHub bloque tout fichier > 100 Mo, et un fichier trop lourd ralentit chaque `git clone`/déploiement.

Run: `ls -lh prisma/geo-data/`
Expected: aucun fichier > 40 Mo

- [ ] **Step 4: Vérifier que chaque feature a bien un nom**

```bash
node -e "
const fs = require('fs');
const adm2 = JSON.parse(fs.readFileSync('prisma/geo-data/mdg-adm2-simplified.geojson', 'utf8'));
const missing = adm2.features.filter(f => !f.properties || !f.properties.shapeName);
console.log('ADM2 features:', adm2.features.length, '- missing shapeName:', missing.length);
"
```

Expected: `ADM2 features: 119 - missing shapeName: 0`

- [ ] **Step 5: Commit**

```bash
git add scripts/prepare-geo-data.ts prisma/geo-data
git commit -m "chore: add and run geo boundary data preparation script"
```

---

### Task 4: `geo-lookup.ts` — recherche point-dans-polygone

**Files:**
- Create: `src/lib/geo-lookup.ts`
- Test: `src/lib/geo-lookup.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/geo-lookup.test.ts
import { describe, it, expect } from 'vitest'
import { findDistrictNameAt, findCommuneNameAt } from './geo-lookup'

describe('geo-lookup', () => {
  it('finds the district containing Antananarivo city center', () => {
    // -18.8792, 47.5079 is central Antananarivo
    const name = findDistrictNameAt(-18.8792, 47.5079)
    expect(name).toBeTruthy()
    expect(typeof name).toBe('string')
  })

  it('returns undefined for a point in the ocean, far from any land', () => {
    const name = findDistrictNameAt(-10, 40)
    expect(name).toBeUndefined()
  })

  it('finds a commune for a valid coordinate when the data has commune coverage there', () => {
    const name = findCommuneNameAt(-18.8792, 47.5079)
    // Not every point necessarily resolves to a commune at simplified
    // resolution, but the function must not throw and must return a string
    // or undefined.
    expect(name === undefined || typeof name === 'string').toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/geo-lookup.test.ts`
Expected: FAIL — `Cannot find module './geo-lookup'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/geo-lookup.ts
import fs from 'fs'
import path from 'path'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

type NamedFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { shapeName: string }>

function loadFeatures(filename: string): NamedFeature[] {
  const filePath = path.join(process.cwd(), 'prisma', 'geo-data', filename)
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw).features
}

let districtFeatures: NamedFeature[] | undefined
let communeFeatures: NamedFeature[] | undefined

function getDistrictFeatures(): NamedFeature[] {
  if (!districtFeatures) districtFeatures = loadFeatures('mdg-adm2-simplified.geojson')
  return districtFeatures
}

function getCommuneFeatures(): NamedFeature[] {
  if (!communeFeatures) communeFeatures = loadFeatures('mdg-adm3-simplified.geojson')
  return communeFeatures
}

function findFeatureNameAt(lat: number, lng: number, features: NamedFeature[]): string | undefined {
  const pt = point([lng, lat])
  const match = features.find((f) => booleanPointInPolygon(pt, f.geometry))
  return match?.properties.shapeName
}

export function findDistrictNameAt(lat: number, lng: number): string | undefined {
  return findFeatureNameAt(lat, lng, getDistrictFeatures())
}

export function findCommuneNameAt(lat: number, lng: number): string | undefined {
  return findFeatureNameAt(lat, lng, getCommuneFeatures())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/geo-lookup.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo-lookup.ts src/lib/geo-lookup.test.ts
git commit -m "feat: add point-in-polygon district/commune lookup service"
```

---

### Task 5: Seed des régions/districts/communes

**Files:**
- Create: `prisma/seed-geo.ts`
- Modify: `package.json` (script npm)

- [ ] **Step 1: Écrire le script de seed**

```typescript
// prisma/seed-geo.ts
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { prisma } from '@/lib/prisma'

const REGIONS: { name: string; code: string }[] = [
  { name: 'Alaotra-Mangoro', code: 'ALM' },
  { name: "Amoron'i Mania", code: 'AMN' },
  { name: 'Analamanga', code: 'ANL' },
  { name: 'Analanjirofo', code: 'ALJ' },
  { name: 'Androy', code: 'ADR' },
  { name: 'Anosy', code: 'ANS' },
  { name: 'Atsimo-Atsinanana', code: 'ASN' },
  { name: 'Atsinanana', code: 'ATN' },
  { name: 'Atsimo-Andrefana', code: 'AAF' },
  { name: 'Betsiboka', code: 'BTB' },
  { name: 'Boeny', code: 'BOE' },
  { name: 'Bongolava', code: 'BGL' },
  { name: 'Diana', code: 'DIA' },
  { name: 'Fitovinany', code: 'FTV' },
  { name: 'Haute Matsiatra', code: 'HMA' },
  { name: 'Ihorombe', code: 'IHO' },
  { name: 'Itasy', code: 'ITS' },
  { name: 'Melaky', code: 'MLK' },
  { name: 'Menabe', code: 'MNB' },
  { name: 'Sava', code: 'SAV' },
  { name: 'Sofia', code: 'SOF' },
  { name: 'Vakinankaratra', code: 'VAK' },
  { name: 'Vatovavy', code: 'VTV' },
]

// geoBoundaries ADM1 shapeName -> nom de région fixe ci-dessus, pour le
// rattachement automatique par centroïde. "Vatovavy-Fitovinany" est
// délibérément absent : ses districts sont résolus via
// DISTRICT_REGION_OVERRIDES ci-dessous.
const ADM1_NAME_TO_REGION: Record<string, string> = {
  'Matsiatra Ambony': 'Haute Matsiatra',
}

// Les 5 districts de la zone fusionnée geoBoundaries "Vatovavy-Fitovinany",
// répartis manuellement selon leur appartenance historique (voir spec section 3).
const DISTRICT_REGION_OVERRIDES: Record<string, string> = {
  'Ifanadiana': 'Vatovavy',
  'Nosy-Varika': 'Vatovavy',
  'Mananjary': 'Vatovavy',
  'Manakara Atsimo': 'Fitovinany',
  'Ikongo': 'Fitovinany',
}

type NamedFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { shapeName: string }>

function loadFeatures(filename: string): NamedFeature[] {
  const filePath = path.join(process.cwd(), 'prisma', 'geo-data', filename)
  return JSON.parse(fs.readFileSync(filePath, 'utf8')).features
}

function ringCentroid(ring: number[][]): [number, number] {
  let x = 0
  let y = 0
  for (const [lng, lat] of ring) {
    x += lng
    y += lat
  }
  return [x / ring.length, y / ring.length]
}

function featureCentroid(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  if (geometry.type === 'Polygon') return ringCentroid(geometry.coordinates[0])
  let best = geometry.coordinates[0][0]
  for (const poly of geometry.coordinates) {
    if (poly[0].length > best.length) best = poly[0]
  }
  return ringCentroid(best)
}

export async function seedGeo() {
  const regionIdByName = new Map<string, string>()
  for (const r of REGIONS) {
    const region = await prisma.region.upsert({
      where: { name: r.name },
      update: { code: r.code },
      create: { name: r.name, code: r.code },
    })
    regionIdByName.set(r.name, region.id)
  }

  const adm1Features = loadFeatures('mdg-adm1.geojson')
  const adm2Features = loadFeatures('mdg-adm2-simplified.geojson')
  const adm3Features = loadFeatures('mdg-adm3-simplified.geojson')

  const districtIdByName = new Map<string, string>()

  for (const district of adm2Features) {
    const districtName = district.properties.shapeName
    let regionName = DISTRICT_REGION_OVERRIDES[districtName]

    if (!regionName) {
      const centroid = featureCentroid(district.geometry)
      const pt = point(centroid)
      const containingRegion = adm1Features.find((r) => booleanPointInPolygon(pt, r.geometry))
      if (!containingRegion) {
        throw new Error(`No ADM1 region found for district "${districtName}" — add a manual override`)
      }
      const adm1Name = containingRegion.properties.shapeName
      regionName = ADM1_NAME_TO_REGION[adm1Name] ?? adm1Name
    }

    const regionId = regionIdByName.get(regionName)
    if (!regionId) {
      throw new Error(`District "${districtName}" resolved to unknown region "${regionName}"`)
    }

    const created = await prisma.district.upsert({
      where: { regionId_name: { regionId, name: districtName } },
      update: {},
      create: { name: districtName, regionId },
    })
    districtIdByName.set(districtName, created.id)
  }

  let communeCount = 0
  let skippedCount = 0
  for (const commune of adm3Features) {
    const communeName = commune.properties.shapeName
    const centroid = featureCentroid(commune.geometry)
    const pt = point(centroid)
    const containingDistrict = adm2Features.find((d) => booleanPointInPolygon(pt, d.geometry))
    if (!containingDistrict) {
      skippedCount++
      continue
    }
    const districtId = districtIdByName.get(containingDistrict.properties.shapeName)
    if (!districtId) {
      skippedCount++
      continue
    }

    await prisma.commune.upsert({
      where: { districtId_name: { districtId, name: communeName } },
      update: {},
      create: { name: communeName, districtId },
    })
    communeCount++
  }

  console.log(
    `Seeded ${REGIONS.length} regions, ${districtIdByName.size} districts, ${communeCount} communes (${skippedCount} communes skipped — no containing district found).`
  )
}

if (require.main === module) {
  seedGeo().finally(() => prisma.$disconnect())
}
```

- [ ] **Step 2: Ajouter un script npm dédié**

Dans `package.json`, section `scripts`, ajouter :

```json
"seed:geo": "tsx prisma/seed-geo.ts"
```

- [ ] **Step 3: Exécuter le seed**

```bash
npm run seed:geo
```

Expected : sortie `Seeded 23 regions, 119 districts, N communes (M communes skipped...)` sans erreur. Si une erreur `No ADM1 region found for district "X"` apparaît, ajouter ce district dans `DISTRICT_REGION_OVERRIDES` avec la bonne région (déterminée manuellement en cherchant "X Madagascar district région" ou en inspectant sa position sur la carte) et relancer.

- [ ] **Step 4: Vérifier en base**

```bash
node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('Regions:', await p.region.count());
  console.log('Districts:', await p.district.count());
  console.log('Communes:', await p.commune.count());
  const vtv = await p.region.findUnique({ where: { name: 'Vatovavy' }, include: { districts: true } });
  console.log('Vatovavy districts:', vtv.districts.map(d => d.name));
  const ftv = await p.region.findUnique({ where: { name: 'Fitovinany' }, include: { districts: true } });
  console.log('Fitovinany districts:', ftv.districts.map(d => d.name));
  await p.\$disconnect();
})();
"
```

Expected: `Regions: 23`, `Districts: 119`, `Vatovavy districts` includes `Ifanadiana`, `Nosy-Varika`, `Mananjary`; `Fitovinany districts` includes `Manakara Atsimo`, `Ikongo`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-geo.ts package.json
git commit -m "feat: seed 23 fixed regions and geoBoundaries-derived districts/communes"
```

---

### Task 6: Réécrire `reference.ts`

**Files:**
- Modify: `src/lib/reference.ts`
- Test: `src/lib/reference.test.ts` (nouveau)

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reference.test.ts
import { describe, it, expect } from 'vitest'
import { generateReference } from './reference'

describe('generateReference', () => {
  it('formats region code and 4-digit sequence', () => {
    expect(generateReference({ sequence: 1, regionCode: 'DIA' })).toBe('DIA-0001')
  })

  it('pads sequences up to 4 digits', () => {
    expect(generateReference({ sequence: 42, regionCode: 'ANL' })).toBe('ANL-0042')
    expect(generateReference({ sequence: 9999, regionCode: 'ANL' })).toBe('ANL-9999')
  })

  it('does not truncate sequences beyond 4 digits', () => {
    expect(generateReference({ sequence: 12345, regionCode: 'ANL' })).toBe('ANL-12345')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reference.test.ts`
Expected: FAIL — `generateReference` still expects the old `{ sequence, city, prefixes }` shape, TypeScript error or wrong output.

- [ ] **Step 3: Replace the implementation**

```typescript
// src/lib/reference.ts
export function generateReference({
  sequence,
  regionCode,
}: {
  sequence: number
  regionCode: string
}): string {
  const padded = String(sequence).padStart(4, '0')
  return `${regionCode}-${padded}`
}
```

Supprimer `resolveCityPrefix` (n'est plus utilisé nulle part après le Task 8).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reference.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reference.ts src/lib/reference.test.ts
git commit -m "feat: rewrite reference generation as REGION_CODE-0000, drop city prefix logic"
```

---

### Task 7: `billboard-geo.ts` — résolution haut niveau

**Files:**
- Create: `src/lib/billboard-geo.ts`
- Test: `src/lib/billboard-geo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/billboard-geo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findDistrictNameAt = vi.fn()
const findCommuneNameAt = vi.fn()
vi.mock('./geo-lookup', () => ({ findDistrictNameAt: (...args: unknown[]) => findDistrictNameAt(...args), findCommuneNameAt: (...args: unknown[]) => findCommuneNameAt(...args) }))

const districtFindFirst = vi.fn()
const communeFindFirst = vi.fn()
vi.mock('./prisma', () => ({
  prisma: {
    district: { findFirst: (...args: unknown[]) => districtFindFirst(...args) },
    commune: { findFirst: (...args: unknown[]) => communeFindFirst(...args) },
  },
}))

import { resolveGeoForCoordinates } from './billboard-geo'

beforeEach(() => {
  findDistrictNameAt.mockReset()
  findCommuneNameAt.mockReset()
  districtFindFirst.mockReset()
  communeFindFirst.mockReset()
})

describe('resolveGeoForCoordinates', () => {
  it('returns null when no district is found', async () => {
    findDistrictNameAt.mockReturnValue(undefined)
    const result = await resolveGeoForCoordinates(-10, 40)
    expect(result).toBeNull()
  })

  it('returns null when the district name has no matching DB row', async () => {
    findDistrictNameAt.mockReturnValue('Unknown District')
    districtFindFirst.mockResolvedValue(null)
    const result = await resolveGeoForCoordinates(-18.87, 47.5)
    expect(result).toBeNull()
  })

  it('resolves region/district ids, and commune id when found', async () => {
    findDistrictNameAt.mockReturnValue('1er Arrondissement')
    districtFindFirst.mockResolvedValue({ id: 'district-1', regionId: 'region-1' })
    findCommuneNameAt.mockReturnValue('Commune X')
    communeFindFirst.mockResolvedValue({ id: 'commune-1' })

    const result = await resolveGeoForCoordinates(-18.87, 47.5)
    expect(result).toEqual({ regionId: 'region-1', districtId: 'district-1', communeId: 'commune-1' })
  })

  it('resolves with a null communeId when no commune is found', async () => {
    findDistrictNameAt.mockReturnValue('1er Arrondissement')
    districtFindFirst.mockResolvedValue({ id: 'district-1', regionId: 'region-1' })
    findCommuneNameAt.mockReturnValue(undefined)

    const result = await resolveGeoForCoordinates(-18.87, 47.5)
    expect(result).toEqual({ regionId: 'region-1', districtId: 'district-1', communeId: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/billboard-geo.test.ts`
Expected: FAIL — `Cannot find module './billboard-geo'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/billboard-geo.ts
import { prisma } from '@/lib/prisma'
import { findDistrictNameAt, findCommuneNameAt } from '@/lib/geo-lookup'

export type ResolvedGeo = { regionId: string; districtId: string; communeId: string | null }

export async function resolveGeoForCoordinates(lat: number, lng: number): Promise<ResolvedGeo | null> {
  const districtName = findDistrictNameAt(lat, lng)
  if (!districtName) return null

  const district = await prisma.district.findFirst({ where: { name: districtName } })
  if (!district) return null

  const communeName = findCommuneNameAt(lat, lng)
  const commune = communeName
    ? await prisma.commune.findFirst({ where: { name: communeName, districtId: district.id } })
    : null

  return { regionId: district.regionId, districtId: district.id, communeId: commune?.id ?? null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/billboard-geo.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/billboard-geo.ts src/lib/billboard-geo.test.ts
git commit -m "feat: add high-level geo resolution (coordinates -> region/district/commune ids)"
```

---

### Task 8: `POST /api/billboards` — création avec détection auto

**Files:**
- Modify: `src/app/api/billboards/route.ts`

- [ ] **Step 1: Réécrire la route**

```typescript
// src/app/api/billboards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { generateReference } from '@/lib/reference'
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
import { buildBillboardWhere } from './where'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const where = buildBillboardWhere(req.nextUrl.searchParams)
  const billboards = await prisma.billboard.findMany({
    where,
    include: {
      occupancies: { where: { status: 'ACTIVE' }, include: { client: true } },
      region: true,
      district: true,
      commune: true,
    },
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
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']),
  sides: z.union([z.literal(1), z.literal(2)]),
  note: z.string().trim().max(2000).optional(),
  permitNumber: z.string().trim().max(100).optional(),
  taxPaymentRef: z.string().trim().max(200).optional(),
  regionId: z.string().optional(),
  districtId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error
  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  let regionId = body.regionId
  let districtId = body.districtId
  let communeId: string | null = null

  if (regionId && districtId) {
    // Repli manuel : la région/district ont été choisis explicitement par
    // l'utilisateur (la détection auto avait échoué). On tente quand même de
    // résoudre la commune pour l'affichage, sans bloquer si elle est introuvable.
    const resolved = await resolveGeoForCoordinates(body.lat, body.lng)
    communeId = resolved?.communeId ?? null
  } else {
    const resolved = await resolveGeoForCoordinates(body.lat, body.lng)
    if (!resolved) {
      return NextResponse.json(
        {
          error: 'GEO_NOT_FOUND',
          message: "Impossible de déterminer la région/district à ces coordonnées. Sélectionnez-les manuellement.",
        },
        { status: 422 }
      )
    }
    regionId = resolved.regionId
    districtId = resolved.districtId
    communeId = resolved.communeId
  }

  const region = await prisma.region.findUnique({ where: { id: regionId } })
  if (!region) return NextResponse.json({ error: 'Région invalide' }, { status: 400 })

  const count = await prisma.billboard.count({ where: { regionId } })
  const reference = generateReference({ sequence: count + 1, regionCode: region.code })

  try {
    const billboard = await prisma.billboard.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        dimension: body.dimension,
        sides: body.sides,
        note: body.note,
        permitNumber: body.permitNumber,
        taxPaymentRef: body.taxPaymentRef,
        reference,
        regionId,
        districtId,
        communeId,
      },
    })
    return NextResponse.json(billboard, { status: 201 })
  } catch (err) {
    // Reference is unique; under concurrent requests for the same region the
    // count-then-create sequence can race and collide. At this project's
    // scale (3 users, <500 billboards) a clean error is enough — no retry loop.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Collision de référence, veuillez réessayer' },
        { status: 409 }
      )
    }
    throw err
  }
}
```

- [ ] **Step 2: Mettre à jour `where.ts` pour filtrer par région/district/commune**

```typescript
// src/app/api/billboards/where.ts
import type { Prisma } from '@prisma/client'

export function buildBillboardWhere(params: URLSearchParams): Prisma.BillboardWhereInput {
  const where: Prisma.BillboardWhereInput = {}
  const regionId = params.get('regionId')
  const districtId = params.get('districtId')
  const communeId = params.get('communeId')
  const dimension = params.get('dimension')
  const damaged = params.get('damaged')

  if (regionId) where.regionId = regionId
  if (districtId) where.districtId = districtId
  if (communeId) where.communeId = communeId
  if (dimension) where.dimension = dimension as Prisma.BillboardWhereInput['dimension']
  if (damaged !== null) where.damaged = damaged === 'true'

  const clientId = params.get('clientId')
  if (clientId) where.occupancies = { some: { clientId, status: 'ACTIVE' } }

  return where
}
```

- [ ] **Step 3: Vérifier manuellement**

Run: `npx tsc --noEmit`
Expected: pas d'erreur de type dans ces deux fichiers (des erreurs peuvent subsister ailleurs tant que les autres tasks ne sont pas faites — normal à ce stade).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billboards/route.ts src/app/api/billboards/where.ts
git commit -m "feat(api): create billboards with automatic region/district detection and manual fallback"
```

---

### Task 9: `PATCH /api/billboards/[id]` — recalcul sur changement de coordonnées

**Files:**
- Modify: `src/app/api/billboards/[id]/route.ts`

- [ ] **Step 1: Réécrire le PATCH (et le GET pour inclure région/district/commune)**

```typescript
// src/app/api/billboards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { deleteBillboardCascade, removePhotoFiles } from '@/lib/billboard-delete'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      region: true,
      district: true,
      commune: true,
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...billboard, status: deriveBillboardStatus(billboard) })
}

const patchSchema = z.object({
  damaged: z.boolean().optional(),
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
  regionId: z.string().optional(),
  districtId: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const data = parsed.data

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'EDIT_BILLBOARD', {
      billboardId: params.id,
      ...data,
    })
  }

  const updateData: Record<string, unknown> = { ...data }

  const coordsChanged = data.lat !== undefined || data.lng !== undefined
  if (coordsChanged && !(data.regionId && data.districtId)) {
    const existing = await prisma.billboard.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const lat = data.lat ?? existing.lat
    const lng = data.lng ?? existing.lng
    const resolved = await resolveGeoForCoordinates(lat, lng)
    if (!resolved) {
      return NextResponse.json(
        {
          error: 'GEO_NOT_FOUND',
          message: "Impossible de déterminer la région/district à ces coordonnées. Sélectionnez-les manuellement.",
        },
        { status: 422 }
      )
    }
    updateData.regionId = resolved.regionId
    updateData.districtId = resolved.districtId
    updateData.communeId = resolved.communeId
  }

  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: updateData })
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

  const existing = await prisma.billboard.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filenames = await prisma.$transaction((tx) => deleteBillboardCascade(tx, params.id))
  await removePhotoFiles(filenames)
  return NextResponse.json({ status: 'deleted' })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/billboards/[id]/route.ts
git commit -m "feat(api): recompute region/district/commune when billboard coordinates change"
```

---

### Task 10: Nouvelles routes `GET /api/regions` et `GET /api/districts`

**Files:**
- Create: `src/app/api/regions/route.ts`
- Create: `src/app/api/districts/route.ts`

- [ ] **Step 1: `GET /api/regions`**

```typescript
// src/app/api/regions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(regions)
}
```

- [ ] **Step 2: `GET /api/districts` (filtrable par région)**

```typescript
// src/app/api/districts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const regionId = req.nextUrl.searchParams.get('regionId')
  const districts = await prisma.district.findMany({
    where: regionId ? { regionId } : undefined,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(districts)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/regions/route.ts src/app/api/districts/route.ts
git commit -m "feat(api): add read-only regions and districts endpoints"
```

---

### Task 11: Payload `EDIT_BILLBOARD` dans les approbations

**Files:**
- Modify: `src/app/api/approvals/[id]/route.ts`

- [ ] **Step 1: Mettre à jour `applyApproval` pour le cas `EDIT_BILLBOARD`**

Dans `src/app/api/approvals/[id]/route.ts`, le cas `EDIT_BILLBOARD` existant :

```typescript
    case 'EDIT_BILLBOARD': {
      const { billboardId, ...fields } = data
      await tx.billboard.update({
        where: { id: billboardId as string },
        data: fields as Record<string, unknown>,
      })
      break
    }
```

n'a pas besoin de changer — `fields` contient déjà tout ce que `PATCH` a reçu (potentiellement `regionId`/`districtId`/`communeId` si le PATCH avait pu les résoudre côté USER). **Cependant**, comme la résolution géo dans `PATCH /api/billboards/[id]` (Task 9) ne s'exécute que pour ADMIN/DEV (le chemin USER retourne `createApprovalRequest` avant d'atteindre la résolution), le payload d'une demande USER avec `lat`/`lng` modifiés ne contient PAS encore `regionId`/`districtId`/`communeId` recalculés. Il faut donc résoudre la géo ici aussi, au moment de l'application de l'approbation, si `lat`/`lng` sont présents dans le payload sans `regionId`/`districtId` explicites.

Remplacer le cas `EDIT_BILLBOARD` par :

```typescript
    case 'EDIT_BILLBOARD': {
      const { billboardId, ...fields } = data
      const updateFields = { ...fields } as Record<string, unknown>

      const coordsChanged = 'lat' in updateFields || 'lng' in updateFields
      if (coordsChanged && !(updateFields.regionId && updateFields.districtId)) {
        const existing = await tx.billboard.findUnique({ where: { id: billboardId as string } })
        if (existing) {
          const lat = (updateFields.lat as number | undefined) ?? existing.lat
          const lng = (updateFields.lng as number | undefined) ?? existing.lng
          const resolved = await resolveGeoForCoordinates(lat, lng)
          if (resolved) {
            updateFields.regionId = resolved.regionId
            updateFields.districtId = resolved.districtId
            updateFields.communeId = resolved.communeId
          }
          // Si la résolution échoue ici (frontière introuvable), on laisse les
          // anciennes région/district/commune inchangées plutôt que de bloquer
          // l'approbation — un cas rare, corrigible ensuite manuellement.
        }
      }

      await tx.billboard.update({
        where: { id: billboardId as string },
        data: updateFields,
      })
      break
    }
```

Ajouter l'import en haut du fichier :

```typescript
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
```

- [ ] **Step 2: Mettre à jour les libellés d'affichage dans la file d'approbation**

Dans `src/components/approvals/ApprovalQueue.tsx`, `PAYLOAD_LABELS` contient encore `city: 'Ville'` (n'apparaîtra simplement plus jamais dans un payload une fois cette task terminée, mais autant nettoyer). Remplacer :

```typescript
  city: 'Ville',
```

par :

```typescript
  regionId: 'Région',
  districtId: 'District',
  communeId: 'Commune',
```

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: pas de nouvelle erreur dans `src/app/api/approvals/[id]/route.ts` ni `src/components/approvals/ApprovalQueue.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/approvals/[id]/route.ts src/components/approvals/ApprovalQueue.tsx
git commit -m "fix(approvals): resolve region/district/commune when applying a USER's coordinate edit"
```

---

### Task 12: `BillboardForm.tsx` — UI de création/édition

**Files:**
- Modify: `src/components/billboard/BillboardForm.tsx`

- [ ] **Step 1: Réécrire le formulaire**

Remplacer le champ "Ville" (texte libre) par un affichage en lecture seule de la région/district détectés, avec repli manuel en cas d'échec (réponse `422` / `GEO_NOT_FOUND`) :

```typescript
// src/components/billboard/BillboardForm.tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

type Region = { id: string; name: string; code: string }
type District = { id: string; name: string; regionId: string }

export type EditableBillboard = {
  id: string
  regionId: string
  districtId: string
  regionName: string
  districtName: string
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

  // Repli manuel : rempli seulement si la détection auto échoue (422).
  const [geoFallback, setGeoFallback] = useState(false)
  const [regions, setRegions] = useState<Region[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [manualRegionId, setManualRegionId] = useState('')
  const [manualDistrictId, setManualDistrictId] = useState('')

  useEffect(() => {
    if (mode === 'create' && props.initialLatLng) {
      setLat(String(props.initialLatLng.lat))
      setLng(String(props.initialLatLng.lng))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === 'create' ? props.initialLatLng : null])

  useEffect(() => {
    if (!geoFallback) return
    fetch('/api/regions')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRegions)
      .catch(() => {})
  }, [geoFallback])

  useEffect(() => {
    if (!manualRegionId) {
      setDistricts([])
      return
    }
    fetch(`/api/districts?regionId=${manualRegionId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setDistricts)
      .catch(() => {})
  }, [manualRegionId])

  const submit = async () => {
    if (!lat.trim() || !lng.trim()) return
    if (geoFallback && (!manualRegionId || !manualDistrictId)) return
    setSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/billboards' : `/api/billboards/${props.billboard.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const shared = {
        lat: Number(lat),
        lng: Number(lng),
        dimension,
        sides,
        permitNumber: permitNumber.trim() || (mode === 'edit' ? null : undefined),
        taxPaymentRef: taxPaymentRef.trim() || (mode === 'edit' ? null : undefined),
        ...(geoFallback ? { regionId: manualRegionId, districtId: manualDistrictId } : {}),
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

      if (res.status === 422) {
        const errBody = await res.json().catch(() => null)
        if (errBody?.error === 'GEO_NOT_FOUND') {
          setGeoFallback(true)
          setError('Région/district introuvables automatiquement — sélectionnez-les ci-dessous.')
          return
        }
      }

      if (res.status === 202 || res.ok) {
        if (res.status === 202) {
          toast.info("Demande d'approbation envoyée", {
            description: 'Un administrateur doit valider cette modification.',
          })
        } else {
          toast.success(mode === 'create' ? 'Panneau créé' : 'Panneau modifié')
        }
        if (mode === 'create') {
          setDimension('D4X3')
          setSides(1)
          setLat('')
          setLng('')
          setPermitNumber('')
          setTaxPaymentRef('')
          setGeoFallback(false)
          setManualRegionId('')
          setManualDistrictId('')
        }
        onOpenChange(false)
        onSaved()
        return
      }
      const errBody = await res.json().catch(() => null)
      throw new Error(typeof errBody?.error === 'string' ? errBody.error : `Request failed with status ${res.status}`)
    } catch (err) {
      const fallback = mode === 'create' ? 'Erreur lors de la création du panneau' : 'Erreur lors de la modification du panneau'
      setError(err instanceof Error && !err.message.startsWith('Request failed') ? err.message : fallback)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !submitting && !!lat.trim() && !!lng.trim() && (!geoFallback || (!!manualRegionId && !!manualDistrictId))

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

          {mode === 'edit' && !geoFallback && (
            <p className="text-sm text-slate-500">
              {props.billboard.regionName} — {props.billboard.districtName}
            </p>
          )}

          {geoFallback && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Région</Label>
                <Select
                  items={Object.fromEntries(regions.map((r) => [r.id, r.name]))}
                  value={manualRegionId}
                  onValueChange={(v: string | null) => {
                    setManualRegionId(v ?? '')
                    setManualDistrictId('')
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>District</Label>
                <Select
                  items={Object.fromEntries(districts.map((d) => [d.id, d.name]))}
                  value={manualDistrictId}
                  onValueChange={(v: string | null) => setManualDistrictId(v ?? '')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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
          <Button onClick={submit} className="w-full" disabled={!canSubmit}>
            {submitting ? (mode === 'create' ? 'Création…' : 'Enregistrement…') : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Mettre à jour l'appelant en mode edit (`src/app/billboards/[id]/page.tsx`)**

Ce fichier construit aujourd'hui la prop `billboard` de `BillboardDetailActions` avec `city: billboard.city` (ligne 48) et affiche `{billboard.city}` en en-tête (ligne 38). Le modèle Prisma `Billboard` n'a plus de champ `city` depuis Task 2/19 mais expose `region`/`district` via `include` — ajouter ces relations à la requête et remplacer les deux usages :

```typescript
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' } },
      region: true,
      district: true,
    },
  })
```

Ligne 38 :

```typescript
          <p className="text-slate-600 font-medium">{billboard.region.name} — {billboard.district.name} — {billboard.dimension} — {billboard.sides} face(s)</p>
```

Bloc `BillboardDetailActions` (lignes 45-57) :

```typescript
            <BillboardDetailActions
              billboard={{
                id: billboard.id,
                regionId: billboard.regionId,
                districtId: billboard.districtId,
                regionName: billboard.region.name,
                districtName: billboard.district.name,
                dimension: billboard.dimension,
                sides: billboard.sides,
                note: billboard.note,
                lat: billboard.lat,
                lng: billboard.lng,
                permitNumber: billboard.permitNumber,
                taxPaymentRef: billboard.taxPaymentRef,
              }}
            />
```

Run: `npx tsc --noEmit`
Expected: pas d'erreur restante sur `src/app/billboards/[id]/page.tsx` ni `src/components/billboard/BillboardDetailActions.tsx` (ce dernier ne fait que transmettre `EditableBillboard` à `BillboardForm`, aucun changement de code nécessaire dedans).

- [ ] **Step 3: Commit**

```bash
git add src/components/billboard/BillboardForm.tsx
git commit -m "feat(ui): billboard form shows auto-detected region/district, manual fallback on failure"
```

---

### Task 13: `FilterBar.tsx` — filtres région/district/commune

**Files:**
- Modify: `src/components/table/FilterBar.tsx`

- [ ] **Step 1: Réécrire le composant**

```typescript
// src/components/table/FilterBar.tsx
'use client'

import { useEffect, useState } from 'react'
import { STATUS_LABELS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'
import { cn } from '@/lib/utils'

export type Filters = {
  regionId?: string
  districtId?: string
  communeId?: string
  status?: string
  dimension?: string
  damaged?: string
  clientId?: string
}

const STATUSES: BillboardStatus[] = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']
const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

const selectClass =
  'h-9 flex-1 min-w-[95px] rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%20stroke%3D%27%2394a3b8%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27M4%206l4%204%204-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_8px_center] bg-no-repeat'

export function FilterBar({ filters, onChange, className }: { filters: Filters; onChange: (f: Filters) => void; className?: string }) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [districts, setDistricts] = useState<{ id: string; name: string; regionId: string }[]>([])

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/regions')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(filters.regionId ? `/api/districts?regionId=${filters.regionId}` : '/api/districts')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [filters.regionId])

  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b bg-slate-50/50 px-4 py-3 sm:px-6 sm:py-4", className)}>
      <select
        className={selectClass}
        value={filters.regionId ?? ''}
        onChange={(e) => onChange({ ...filters, regionId: e.target.value || undefined, districtId: undefined })}
      >
        <option value="">Toutes les régions</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.districtId ?? ''}
        onChange={(e) => onChange({ ...filters, districtId: e.target.value || undefined })}
      >
        <option value="">Tous les districts</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.status ?? ''}
        onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
      >
        <option value="">Tous les statuts</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.dimension ?? ''}
        onChange={(e) => onChange({ ...filters, dimension: e.target.value || undefined })}
      >
        <option value="">Toutes dimensions</option>
        {DIMENSIONS.map((d) => (
          <option key={d} value={d}>{d.replace('D', '').replace('X', 'x')}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.damaged ?? ''}
        onChange={(e) => onChange({ ...filters, damaged: e.target.value || undefined })}
      >
        <option value="">Tous (État)</option>
        <option value="true">Endommagé</option>
        <option value="false">Bon état</option>
      </select>

      <select
        className={selectClass}
        value={filters.clientId ?? ''}
        onChange={(e) => onChange({ ...filters, clientId: e.target.value || undefined })}
      >
        <option value="">Tous les clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/table/FilterBar.tsx
git commit -m "feat(ui): replace city filter with region/district filters"
```

---

### Task 14: `BillboardTable.tsx` et `BillboardDrawer.tsx`

**Files:**
- Modify: `src/components/table/BillboardTable.tsx`
- Modify: `src/components/billboard/BillboardDrawer.tsx`

- [ ] **Step 1: Mettre à jour `BillboardRow` et l'affichage dans `BillboardTable.tsx`**

```typescript
// src/components/table/BillboardTable.tsx
'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'

export type BillboardRow = {
  id: string
  reference: string
  regionName: string
  districtName: string
  communeName?: string | null
  dimension: string
  status: string
  damaged: boolean
  activeClientNames?: string[]
  note?: string | null
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
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center text-slate-500">
        <p className="text-sm font-medium">Aucun panneau ne correspond à ces filtres.</p>
        <p className="text-xs text-slate-400">Essayez d&apos;ajuster vos critères de recherche.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Identifiant</TableHead>
          <TableHead>Région</TableHead>
          <TableHead>District</TableHead>
          <TableHead>Commune</TableHead>
          <TableHead>Dimension</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Clients</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`cursor-pointer transition-all hover:bg-slate-50/80 ${
              selectedId === r.id ? 'bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
            }`}
          >
            <TableCell className="font-semibold text-slate-700 pl-4">{r.reference}</TableCell>
            <TableCell>{r.regionName}</TableCell>
            <TableCell>{r.districtName}</TableCell>
            <TableCell>{r.communeName ?? '—'}</TableCell>
            <TableCell>{r.dimension.replace('D', '').replace('X', 'x')}</TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE_VARIANTS[r.status as BillboardStatus] ?? 'outline'}>
                {STATUS_LABELS[r.status as BillboardStatus] ?? r.status}
              </Badge>
              {r.damaged && r.status !== 'MAINTENANCE' && (
                <Badge variant="destructive" className="ml-1">Endommagé</Badge>
              )}
            </TableCell>
            <TableCell>{r.activeClientNames && r.activeClientNames.length > 0 ? r.activeClientNames.join(', ') : '—'}</TableCell>
            <TableCell className="max-w-[200px] truncate" title={r.note ?? undefined}>{r.note ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Mettre à jour `BillboardDrawer.tsx`**

Dans `src/components/billboard/BillboardDrawer.tsx`, remplacer la ligne 29 :

```typescript
                {billboard.city} — {billboard.dimension.replace('D', '').replace('X', 'x')}
```

par :

```typescript
                {billboard.regionName} · {billboard.districtName} — {billboard.dimension.replace('D', '').replace('X', 'x')}
```

- [ ] **Step 3: Mettre à jour `src/hooks/useBillboards.ts`**

Remplacer le type `ApiBillboard` et la fonction `toRow` :

```typescript
type ApiBillboard = {
  id: string
  reference: string
  region: { name: string } | null
  district: { name: string } | null
  commune: { name: string } | null
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
    regionName: b.region?.name ?? '—',
    districtName: b.district?.name ?? '—',
    communeName: b.commune?.name ?? null,
    dimension: b.dimension,
    status: b.status,
    damaged: b.damaged,
    lat: b.lat,
    lng: b.lng,
    note: b.note,
    activeClientNames,
  }
}
```

- [ ] **Step 4: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: pas d'erreur dans ces fichiers

- [ ] **Step 5: Commit**

```bash
git add src/components/table/BillboardTable.tsx src/components/billboard/BillboardDrawer.tsx src/hooks/useBillboards.ts
git commit -m "feat(ui): show region/district/commune in table and drawer instead of city"
```

---

### Task 15: Exports PDF

**Files:**
- Modify: `src/components/billboard/ParkFullPdf.tsx`
- Modify: `src/components/billboard/ParkSummaryPdf.tsx`
- Modify: `src/components/billboard/BillboardPdfDocument.tsx`
- Modify: `src/app/api/billboards/pdf/route.ts`
- Modify: `src/app/api/billboards/[id]/pdf/route.ts`

- [ ] **Step 1: `ParkSummaryPdf.tsx` — remplacer `city: string` par `regionName: string` et `districtName: string` dans le type `ParkSummaryRow`, et le rendu (ligne ~86, `<Text>{r.city}</Text>`) par :**

```typescript
<Text>{r.regionName} — {r.districtName}</Text>
```

- [ ] **Step 2: `ParkFullPdf.tsx` — même remplacement sur `ParkFullBillboard` (`city: string` → `regionName: string; districtName: string`) et le rendu (ligne ~51) :**

```typescript
<Text>{data.regionName} — {data.districtName}</Text>
```

- [ ] **Step 3: `BillboardPdfDocument.tsx` — même remplacement (ligne 15 et 35) :**

```typescript
<View style={styles.row}><Text style={styles.label}>Région</Text><Text>{data.regionName}</Text></View>
<View style={styles.row}><Text style={styles.label}>District</Text><Text>{data.districtName}</Text></View>
```

- [ ] **Step 4: `src/app/api/billboards/[id]/pdf/route.ts` (export PDF d'un seul panneau) — mettre à jour le `include` et le mapping**

```typescript
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' }, take: 1 },
      region: true,
      district: true,
    },
  })
```

Et remplacer `city: billboard.city,` (ligne 29) par :

```typescript
        regionName: billboard.region.name,
        districtName: billboard.district.name,
```

- [ ] **Step 5: `src/app/api/billboards/pdf/route.ts` (export PDF du parc) — mettre à jour le `include` et le mapping**

```typescript
  const billboards = await prisma.billboard.findMany({
    where,
    include: {
      occupancies: { where: { status: 'ACTIVE' }, include: { client: true } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' }, take: 1 },
      region: true,
      district: true,
    },
    orderBy: { reference: 'asc' },
  })
```

Et dans les deux mappings (`rows` et `data`), remplacer `city: b.city` par :

```typescript
      regionName: b.region.name,
      districtName: b.district.name,
```

- [ ] **Step 6: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: pas d'erreur dans les fichiers PDF

- [ ] **Step 7: Commit**

```bash
git add src/components/billboard/ParkFullPdf.tsx src/components/billboard/ParkSummaryPdf.tsx src/components/billboard/BillboardPdfDocument.tsx src/app/api/billboards/pdf/route.ts src/app/api/billboards/[id]/pdf/route.ts
git commit -m "feat(pdf): show region/district instead of city in park exports"
```

---

### Task 16: Page Réglages en lecture seule + suppression de l'ancienne page

**Files:**
- Create: `src/app/settings/regions/page.tsx`
- Delete: `src/app/settings/city-prefixes/page.tsx`
- Delete: `src/app/api/city-prefixes/route.ts`
- Modify: `src/components/layout/Nav.tsx` (lien Réglages)

- [ ] **Step 1: Créer la page en lecture seule**

```typescript
// src/app/settings/regions/page.tsx
import { prisma } from '@/lib/prisma'

export default async function RegionsPage() {
  const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Régions</h1>
      <p className="text-sm text-slate-600">
        Liste fixe des 23 régions de Madagascar utilisée pour générer l&apos;identifiant des panneaux
        (ex: DIA-0001). Cette liste n&apos;est pas modifiable.
      </p>
      <ul className="divide-y rounded-lg border">
        {regions.map((r) => (
          <li key={r.id} className="flex items-center justify-between p-2 text-sm">
            <span>{r.name}</span>
            <span className="w-24 text-right font-mono">{r.code}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Supprimer les anciens fichiers**

```bash
rm src/app/settings/city-prefixes/page.tsx
rm src/app/api/city-prefixes/route.ts
rmdir src/app/settings/city-prefixes 2>/dev/null || true
rmdir src/app/api/city-prefixes 2>/dev/null || true
```

- [ ] **Step 3: Mettre à jour le lien dans `Nav.tsx`**

Dans `src/components/layout/Nav.tsx`, remplacer :

```typescript
              href="/settings/city-prefixes"
```

par :

```typescript
              href="/settings/regions"
```

et remplacer :

```typescript
              Réglages
```

reste identique (le libellé du lien ne change pas, seul le `href` change), ainsi que la condition `pathname?.startsWith('/settings')` (déjà générique, pas de changement nécessaire).

- [ ] **Step 4: Vérifier que `FilterBar.tsx` n'appelle plus `/api/city-prefixes`**

Déjà fait au Task 13 (le nouveau `FilterBar.tsx` appelle `/api/regions` et `/api/districts`) — vérifier qu'aucune référence à `city-prefixes` ne subsiste :

Run: `grep -r "city-prefixes" src/ --include="*.tsx" --include="*.ts"`
Expected: aucun résultat

- [ ] **Step 5: Commit**

```bash
git add -A src/app/settings src/app/api/city-prefixes src/components/layout/Nav.tsx
git commit -m "feat(settings): replace editable city prefixes page with read-only regions list"
```

---

### Task 17: Mettre à jour `prisma/seed.ts`

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Retirer `seedCityPrefixes`, adapter les données d'exemple, appeler `seedGeo`**

```typescript
// prisma/seed.ts
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { seedGeo } from './seed-geo'

async function main() {
  const users = [
    { email: 'dev@rna.mg', password: 'xK9m2pLq', role: 'DEV' as const },
    { email: 'admin@rna.mg', password: 'Rn4wJ7hB', role: 'ADMIN' as const },
    { email: 'user@rna.mg', password: 'Tz6vF3cY', role: 'USER' as const },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, role: u.role },
    })
  }

  await seedGeo()
  await seedSampleData()
}

async function seedSampleData() {
  const client = await prisma.client.upsert({
    where: { id: 'seed-client-orange' },
    update: {},
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', email: 'contact@orange.mg' },
  })

  const analamanga = await prisma.region.findUniqueOrThrow({ where: { name: 'Analamanga' } })
  const district = await prisma.district.findFirstOrThrow({ where: { regionId: analamanga.id } })

  const billboard = await prisma.billboard.upsert({
    where: { reference: 'ANL-0001' },
    update: {},
    create: {
      reference: 'ANL-0001',
      lat: -18.8792,
      lng: 47.5079,
      regionId: analamanga.id,
      districtId: district.id,
      dimension: 'D4X3',
      sides: 2,
    },
  })

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
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Vérifier que `prisma/seed-geo.ts` exporte bien `seedGeo` sans exécuter `main()` en double**

Le `if (require.main === module)` du Task 5 empêche `seed-geo.ts` de se relancer tout seul quand il est importé par `seed.ts` — vérifier que cette garde est bien en place (voir Task 5, Step 1).

- [ ] **Step 3: Exécuter le seed complet sur une base de test/dev**

```bash
npx prisma db seed
```

Expected: pas d'erreur, `Seeded 23 regions, 119 districts, N communes...` suivi de la création des utilisateurs et du panneau d'exemple.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: update seed script for region/district model, drop city prefix seeding"
```

---

### Task 18: Script de migration des panneaux existants

**Files:**
- Create: `scripts/migrate-billboard-geo.ts`

- [ ] **Step 1: Écrire le script**

```typescript
// scripts/migrate-billboard-geo.ts
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
import { generateReference } from '@/lib/reference'

async function main() {
  const billboards = await prisma.billboard.findMany({
    where: { regionId: null },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${billboards.length} billboards to migrate.`)

  const sequenceByRegion = new Map<string, number>()
  const failures: { id: string; reference: string; lat: number; lng: number }[] = []

  for (const b of billboards) {
    const resolved = await resolveGeoForCoordinates(b.lat, b.lng)
    if (!resolved) {
      failures.push({ id: b.id, reference: b.reference, lat: b.lat, lng: b.lng })
      continue
    }

    const region = await prisma.region.findUniqueOrThrow({ where: { id: resolved.regionId } })
    const nextSeq = (sequenceByRegion.get(resolved.regionId) ?? 0) + 1
    sequenceByRegion.set(resolved.regionId, nextSeq)
    const newReference = generateReference({ sequence: nextSeq, regionCode: region.code })

    await prisma.billboard.update({
      where: { id: b.id },
      data: {
        regionId: resolved.regionId,
        districtId: resolved.districtId,
        communeId: resolved.communeId,
        reference: newReference,
        city: null,
      },
    })
    console.log(`${b.reference} -> ${newReference} (${region.name})`)
  }

  console.log(`\nMigrated ${billboards.length - failures.length}/${billboards.length} billboards.`)
  if (failures.length > 0) {
    console.log(`\n${failures.length} billboards could not be geo-resolved and need manual correction:`)
    for (const f of failures) {
      console.log(`  - ${f.reference} (id: ${f.id}, lat: ${f.lat}, lng: ${f.lng})`)
    }
  }
}

main().finally(() => prisma.$disconnect())
```

**Important — ordre d'exécution par région :** ce script initialise `sequenceByRegion` à zéro pour chaque région, donc il ne fonctionne correctement que sur une base où **aucun panneau n'a encore de `regionId` assigné** (condition `where: { regionId: null }`). S'il faut le relancer après une première exécution partielle, adapter l'initialisation du compteur en le pré-remplissant avec `await prisma.billboard.count({ where: { regionId } })` par région déjà migrée.

- [ ] **Step 2: Exécuter sur la base de développement**

```bash
npx tsx scripts/migrate-billboard-geo.ts
```

Expected : chaque panneau existant affiche son ancienne et sa nouvelle référence ; à la fin, un résumé `Migrated N/N billboards` (idéalement 0 échec — le seed de développement n'a qu'un seul panneau d'exemple, déjà créé avec le nouveau format par `seed.ts` donc `regionId` n'est pas `null` et ce script ne le retouche pas).

- [ ] **Step 3: Vérifier qu'aucun panneau n'a de `regionId` nul après la migration (sur une base contenant des données réelles)**

```bash
node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const count = await p.billboard.count({ where: { regionId: null } });
  console.log('Billboards without regionId:', count);
  await p.\$disconnect();
})();
"
```

Expected : `0` (sur la base de prod, une fois le script exécuté et les échecs éventuels corrigés manuellement via l'interface avec le repli manuel du Task 12).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-billboard-geo.ts
git commit -m "feat: add migration script to backfill region/district/commune on existing billboards"
```

---

### Task 19: Schéma Prisma — phase 2 (suppression `city`/`CityPrefix`, colonnes obligatoires)

**Files:**
- Modify: `prisma/schema.prisma`

**Ne pas exécuter cette task avant que la migration (Task 18) ait tourné avec succès sur la base de production** — cette migration Prisma supprime la colonne `city` et rend `regionId`/`districtId` obligatoires, ce qui échouera si des lignes ont encore `regionId IS NULL`.

- [ ] **Step 1: Retirer `city` et la table `CityPrefix`, rendre les champs géo obligatoires**

Dans `prisma/schema.prisma`, modifier `Billboard` :

```prisma
model Billboard {
  id              String    @id @default(cuid())
  reference       String    @unique
  lat             Float
  lng             Float
  regionId        String
  districtId      String
  communeId       String?
  dimension       Dimension
  sides           Int       @default(1)
  damaged         Boolean   @default(false)
  note            String?
  permitNumber    String?
  taxPaymentRef   String?
  statusOverride  BillboardStatus?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  region             Region               @relation(fields: [regionId], references: [id])
  district           District             @relation(fields: [districtId], references: [id])
  commune            Commune?             @relation(fields: [communeId], references: [id])
  photos             BillboardPhoto[]
  occupancies        Occupancy[]
  maintenanceRecords MaintenanceRecord[]

  @@index([regionId])
  @@index([districtId])
  @@index([communeId])
}
```

Supprimer entièrement le modèle `CityPrefix` (en fin de fichier).

- [ ] **Step 2: Générer la migration**

```bash
npx prisma migrate dev --name drop_city_and_city_prefix
```

Expected : Prisma signale la suppression de la colonne `city` et de la table `CityPrefix`, et le passage de `regionId`/`districtId` en `NOT NULL`. Si l'invite Prisma prévient d'une perte de données potentielle sur `regionId`/`districtId` (colonnes encore nullable avec des valeurs existantes), confirmer — ces colonnes doivent déjà être remplies par la Task 18 à ce stade.

- [ ] **Step 3: Vérifier que l'app démarre et que le seed tourne toujours**

```bash
npx prisma db seed
npm run build
```

Expected: build réussi, seed réussi.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): drop city and CityPrefix, make region/district required on Billboard"
```

---

### Task 20: Vérification finale

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Lancer toute la suite de tests**

Run: `npx vitest run`
Expected: tous les tests passent, y compris les nouveaux (`geo-lookup.test.ts`, `billboard-geo.test.ts`, `reference.test.ts`).

- [ ] **Step 2: Vérifier les types sur tout le projet**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Build de production**

Run: `npm run build`
Expected: build réussi (24 pages ou plus générées, comme lors des vérifications précédentes sur ce projet).

- [ ] **Step 4: Vérification manuelle rapide dans le navigateur**

Démarrer le serveur de dev (`npm run dev`), ouvrir `/database`, créer un panneau en cliquant sur un point de la carte à Madagascar (ex: proche d'Antananarivo), vérifier que la référence générée suit le format `XXX-0001`, que région/district s'affichent correctement dans le tableau, et que le filtre région/district fonctionne. Vérifier aussi `/settings/regions` (liste en lecture seule des 23 régions).

- [ ] **Step 5: Commit final si des ajustements ont été faits pendant la vérification**

```bash
git add -A
git commit -m "chore: final fixes after end-to-end verification"
```
