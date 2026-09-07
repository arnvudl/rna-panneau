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
