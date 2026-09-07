// scripts/prepare-geo-data.ts
import fs from 'fs'
import path from 'path'
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
  // Communes are small enough that 0.005 shrinks them below the coordinates
  // they are supposed to contain: sampling 10 Malagasy city centres, that
  // tolerance located only 7, while 0.001 locates all 10 for 3.7 MB more.
  const adm3Simplified = simplify(adm3, { tolerance: 0.001, highQuality: false })
  fs.writeFileSync(path.join(OUT_DIR, 'mdg-adm3-simplified.geojson'), JSON.stringify(adm3Simplified))

  report('mdg-adm1.geojson')
  report('mdg-adm2-simplified.geojson')
  report('mdg-adm3-simplified.geojson')
}

main()
