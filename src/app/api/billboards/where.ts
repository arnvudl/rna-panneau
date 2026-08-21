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
