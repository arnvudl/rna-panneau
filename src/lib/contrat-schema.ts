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

// All ContratStatus values, mirroring the Prisma enum. Kept as a standalone
// literal list (rather than importing the generated enum) so this schema
// module stays usable from test files that mock @prisma/client.
export const CONTRAT_STATUS_VALUES = ['DRAFT', 'SIGNED', 'ACTIVE', 'ENDED', 'CANCELLED'] as const
export type ContratStatusValue = (typeof CONTRAT_STATUS_VALUES)[number]

// Status values a PATCH request body may carry: either a legacy occupancy
// value (ACTIVE/TERMINATED) or a native ContratStatus value.
export const PATCH_STATUS_VALUES = [
  ...CONTRAT_STATUS_VALUES,
  'TERMINATED',
] as const satisfies readonly (ContratStatusValue | 'TERMINATED')[]
export type PatchStatusValue = (typeof PATCH_STATUS_VALUES)[number]

/**
 * Resolves a PATCH-request status value (legacy or native) to a
 * ContratStatus. Shared by the direct PATCH route and the approvals
 * apply-handler so the mapping can't drift between the two.
 */
export function resolveContratStatus(status: PatchStatusValue): ContratStatusValue {
  if (status in LEGACY_STATUS_TO_CONTRAT_STATUS) {
    return LEGACY_STATUS_TO_CONTRAT_STATUS[status as keyof typeof LEGACY_STATUS_TO_CONTRAT_STATUS]
  }
  return status as ContratStatusValue
}

// Legal forward transitions for the Contrat lifecycle:
// DRAFT -> SIGNED -> ACTIVE -> ENDED, with CANCELLED reachable from any
// non-terminal state. ENDED and CANCELLED are terminal — no transitions out.
export const CONTRAT_STATUS_TRANSITIONS: Record<ContratStatusValue, readonly ContratStatusValue[]> = {
  DRAFT: ['SIGNED', 'CANCELLED'],
  SIGNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ENDED', 'CANCELLED'],
  ENDED: [],
  CANCELLED: [],
}

/**
 * Whether moving a Contrat from `from` to `to` is a legal workflow
 * transition. A no-op (from === to) is always considered valid.
 */
export function isValidContratTransition(from: ContratStatusValue, to: ContratStatusValue): boolean {
  if (from === to) return true
  return CONTRAT_STATUS_TRANSITIONS[from].includes(to)
}
