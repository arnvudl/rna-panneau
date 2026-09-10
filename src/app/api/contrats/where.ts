import type { Prisma } from '@prisma/client'
import { CONTRAT_STATUS_VALUES } from '@/lib/contrat-schema'

/**
 * Builds the Prisma `where` clause for GET /api/contrats from query params.
 * Kept as a pure, standalone function (mirrors billboards' buildBillboardWhere)
 * so the region/district/commune filtering added for the Kanban filter bar is
 * unit-testable without a database.
 *
 * billboardId/clientId/statut filter the Contrat directly; regionId/
 * districtId/communeId filter through the `billboard` relation, since those
 * fields live on Billboard, not Contrat. All filters combine with AND.
 */
export function buildContratWhere(params: URLSearchParams): Prisma.ContratWhereInput {
  const billboardId = params.get('billboardId') ?? undefined
  const clientId = params.get('clientId') ?? undefined
  const statutParam = params.get('statut')
  const statut =
    statutParam && (CONTRAT_STATUS_VALUES as readonly string[]).includes(statutParam)
      ? (statutParam as Prisma.ContratWhereInput['statut'])
      : undefined

  // billboardId/clientId/statut keep their historical shape (always present,
  // possibly undefined) so Prisma's "undefined = no filter" behavior applies
  // exactly as before this file was split out of route.ts.
  const where: Prisma.ContratWhereInput = { billboardId, clientId, statut }

  const regionId = params.get('regionId')
  const districtId = params.get('districtId')
  const communeId = params.get('communeId')

  if (regionId || districtId || communeId) {
    where.billboard = {
      ...(regionId ? { regionId } : {}),
      ...(districtId ? { districtId } : {}),
      ...(communeId ? { communeId } : {}),
    }
  }

  return where
}
