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
  if (clientId) where.contrats = { some: { clientId, statut: 'ACTIVE' } }

  return where
}
