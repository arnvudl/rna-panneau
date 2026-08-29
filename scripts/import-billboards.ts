/**
 * Import billboards from the client's Excel files into the database.
 * Only creates Billboard records — no contracts, no photos, no GPS.
 * The client fills in the missing info (GPS, contracts) via the app.
 *
 * Usage: npx tsx scripts/import-billboards.ts
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { generateReference } from '@/lib/reference'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

// ── Dimension mapping ──────────────────────────────────────────────
const DIMENSION_MAP: Record<string, 'D2X1' | 'D4X3' | 'D6X3' | 'D8X3' | 'D12X3'> = {
  '2x1': 'D2X1', '2X1': 'D2X1',
  '4x3': 'D4X3', '4X3': 'D4X3', '4*3': 'D4X3',
  '6x3': 'D6X3', '6X3': 'D6X3', '6*3': 'D6X3',
  '8x3': 'D8X3', '8X3': 'D8X3', '8*3': 'D8X3',
  '12x3': 'D12X3', '12X3': 'D12X3', '12*3': 'D12X3',
}

// ── City normalization (typos + casing) ────────────────────────────
const CITY_NORMALIZE: Record<string, string> = {
  'ambanja': 'Ambanja',
  'ambatondrazaka': 'Ambatondrazaka',
  'ambilobe': 'Ambilobe',
  'ambositra': 'Ambositra',
  'andapa': 'Andapa',
  'antalaha': 'Antalaha',
  'antsohihy': 'Antsohihy',
  'arivonimamo': 'Arivonimamo',
  'befandriana nord': 'Befandriana Nord',
  'diego': 'Diego',
  'fenerive est': 'Fenerive Est',
  'fianarantsoa': 'Fianarantsoa',
  'fort dauphin': 'Fort Dauphin',
  'maevatanana': 'Maevatanana',
  'majunga': 'Majunga',
  'mampikony': 'Mampikony',
  'mandritsara': 'Mandritsara',
  'maroantsetra': 'Maroantsetra',
  'moramanga': 'Moramanga',
  'morondava': 'Morondava',
  'nosy be': 'Nosy Be',
  'port berger': 'Port Berger',
  'sambava': 'Sambava',
  'smabava': 'Sambava', // typo in Excel
  'ste marie': 'Ste Marie',
  'tamatave': 'Tamatave',
  'tana': 'Tana',
  'tulear': 'Tulear',
  'vatomandry': 'Vatomandry',
  'vohemar': 'Vohemar',
}

function normalizeCity(raw: string): string {
  const key = raw.trim().toLowerCase()
  return CITY_NORMALIZE[key] ?? raw.trim()
}

// ── Excel parser (no npm dependency — xlsx is a zip of XML) ───────
function parseXlsx(filePath: string): Record<string, string>[] {
  const tmpDir = path.join(process.env.TEMP || '/tmp', 'import-xlsx')
  const extractDir = path.join(tmpDir, 'extract')
  try { fs.rmSync(extractDir, { recursive: true }); } catch {}
  fs.mkdirSync(extractDir, { recursive: true })

  const zipCopy = path.join(tmpDir, 'temp.zip')
  fs.copyFileSync(filePath, zipCopy)
  execSync(`powershell -Command "Expand-Archive -Path '${zipCopy}' -DestinationPath '${extractDir}' -Force"`, { timeout: 10000 })

  const sharedStrings: string[] = []
  const ssPath = path.join(extractDir, 'xl', 'sharedStrings.xml')
  if (fs.existsSync(ssPath)) {
    const ssXml = fs.readFileSync(ssPath, 'utf8')
    const re = /<t[^>]*>([^<]*)<\/t>/g
    let m
    while ((m = re.exec(ssXml)) !== null) sharedStrings.push(m[1])
  }

  const sheetsDir = path.join(extractDir, 'xl', 'worksheets')
  const sheetFile = fs.readdirSync(sheetsDir).find(f => f === 'sheet1.xml') || 'sheet1.xml'
  const sheetXml = fs.readFileSync(path.join(sheetsDir, sheetFile), 'utf8')

  const rows: Record<string, string>[] = []
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g
  let rm

  while ((rm = rowRe.exec(sheetXml)) !== null) {
    const row: Record<string, string> = {}
    const cellRe = /<c\s([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm

    while ((cm = cellRe.exec(rm[1])) !== null) {
      const attrs = cm[1]
      const inner = cm[2] || ''
      const refMatch = attrs.match(/r="([A-Z]+)\d+"/)
      const typeMatch = attrs.match(/t="([^"]*)"/)
      const valMatch = inner.match(/<v>([^<]*)<\/v>/)

      const col = refMatch ? refMatch[1] : '?'
      let val = valMatch ? valMatch[1] : ''

      if (typeMatch && typeMatch[1] === 's' && val !== '') {
        val = sharedStrings[parseInt(val)] || val
      }
      if (val !== '') row[col] = val
    }
    if (Object.keys(row).length > 0) rows.push(row)
  }

  try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  return rows
}

// ── Dedup key: city + dimension + localisation ────────────────────
function dedupKey(city: string, dim: string, loc: string): string {
  return `${city}|${dim}|${loc}`.toLowerCase()
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const file1 = 'C:\\Users\\arnau\\Downloads\\base de donnée.xlsx'
  const file2 = 'C:\\Users\\arnau\\Downloads\\Sucettes YAS.xlsx'

  console.log('Parsing Excel files...')
  const rows1 = parseXlsx(file1).slice(1) // skip header
  const rows2 = parseXlsx(file2).slice(1)
  console.log(`  base de donnée: ${rows1.length} rows`)
  console.log(`  Sucettes YAS: ${rows2.length} rows`)

  // Merge and dedup (file 1 is the main source, file 2 is a subset)
  const seen = new Set<string>()
  const billboards: { city: string; dimension: string; note: string }[] = []

  for (const r of rows1) {
    const city = normalizeCity(r.C || '')
    const dimRaw = (r.B || '').trim()
    const dimension = DIMENSION_MAP[dimRaw]
    const localisation = (r.D || '').trim()

    if (!city || !dimension) {
      console.warn(`  SKIP (missing city or dimension): ${JSON.stringify(r)}`)
      continue
    }

    const key = dedupKey(city, dimension, localisation)
    if (seen.has(key)) continue
    seen.add(key)

    billboards.push({ city, dimension, note: localisation || '' })
  }

  // Add any from file 2 not already in file 1
  for (const r of rows2) {
    const city = normalizeCity(r.C || '')
    const dimRaw = (r.B || '').trim()
    const dimension = DIMENSION_MAP[dimRaw]
    const localisation = (r.D || '').trim()

    if (!city || !dimension) continue

    const key = dedupKey(city, dimension, localisation)
    if (seen.has(key)) continue
    seen.add(key)

    billboards.push({ city, dimension, note: localisation || '' })
  }

  console.log(`\n${billboards.length} unique billboards to import`)

  // Load city prefixes for reference generation
  const prefixes = await prisma.cityPrefix.findMany()

  // Count existing billboards per city for sequence numbering
  const existing = await prisma.billboard.findMany({ select: { city: true, reference: true } })
  const seqByCity = new Map<string, number>()
  for (const b of existing) {
    const match = b.reference.match(/(\d+)$/)
    if (match) {
      const seq = parseInt(match[1])
      const current = seqByCity.get(b.city) ?? 0
      if (seq > current) seqByCity.set(b.city, seq)
    }
  }

  // Also track references to avoid collisions
  const existingRefs = new Set(existing.map(b => b.reference))

  let created = 0
  let skipped = 0

  for (const b of billboards) {
    const seq = (seqByCity.get(b.city) ?? 0) + 1
    seqByCity.set(b.city, seq)

    const reference = generateReference({ sequence: seq, city: b.city, prefixes })

    if (existingRefs.has(reference)) {
      console.warn(`  SKIP (reference collision): ${reference}`)
      skipped++
      continue
    }

    await prisma.billboard.create({
      data: {
        reference,
        lat: 0,
        lng: 0,
        city: b.city,
        dimension: b.dimension as 'D2X1' | 'D4X3' | 'D6X3' | 'D8X3' | 'D12X3',
        sides: 1,
        note: b.note || null,
      },
    })

    existingRefs.add(reference)
    created++
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`)
  console.log('The client can now fill in GPS positions via the map and add contracts/photos.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
