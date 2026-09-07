import { prisma } from '@/lib/prisma'
import { findDistrictNameAt, findCommuneNameAt } from '@/lib/geo-lookup'

export type ResolvedGeo = { regionId: string; districtId: string; communeId: string | null }

export async function resolveGeoForCoordinates(
  lat: number,
  lng: number
): Promise<ResolvedGeo | null> {
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
