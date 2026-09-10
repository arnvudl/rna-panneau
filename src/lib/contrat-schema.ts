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
