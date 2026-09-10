import { z } from 'zod'

export const createContratSchema = z.object({
  billboardId: z.string(),
  clientId: z.string(),
  face: z.enum(['FACE_1', 'FACE_2', 'BOTH']).default('BOTH'),
  numero: z.string().trim().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type CreateContratInput = z.infer<typeof createContratSchema>

// Old occupancy status values map onto the richer ContratStatus enum:
// ACTIVE -> ACTIVE, TERMINATED -> ENDED. Shared by the direct PATCH route and
// the approvals apply-handler so the mapping can't drift between the two.
export const LEGACY_STATUS_TO_CONTRAT_STATUS = { ACTIVE: 'ACTIVE', TERMINATED: 'ENDED' } as const
