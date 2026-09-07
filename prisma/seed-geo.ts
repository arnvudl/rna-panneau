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

// geoBoundaries ADM1 shapeName -> our fixed region name, for the automatic
// centroid-in-polygon match below. "Vatovavy-Fitovinany" is deliberately
// absent: its districts are resolved via DISTRICT_REGION_OVERRIDES instead.
const ADM1_NAME_TO_REGION: Record<string, string> = {
  'Matsiatra Ambony': 'Haute Matsiatra',
}

// The 5 districts inside geoBoundaries' merged "Vatovavy-Fitovinany" polygon,
// split by historical region membership.
const DISTRICT_REGION_OVERRIDES: Record<string, string> = {
  'Ifanadiana': 'Vatovavy',
  'Nosy-Varika': 'Vatovavy',
  'Mananjary': 'Vatovavy',
  'Manakara Atsimo': 'Fitovinany',
  'Ikongo': 'Fitovinany',
  // Not a Vatovavy/Fitovinany case: Ambanja's coastal, deeply indented shape puts
  // its computed centroid in the Ampasindava bay, outside every ADM1 polygon.
  // Ambanja is a district of Diana.
  'Ambanja': 'Diana',
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
