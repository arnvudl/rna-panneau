import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import type { ApprovalType } from '@prisma/client'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notifyAdmins } from '@/lib/notifications'

/**
 * Resolves the current session. Callers do:
 *   const { session, error } = await requireSession()
 *   if (error) return error
 */
export async function requireSession(): Promise<
  { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await auth()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session }
}

/**
 * Validates `body` against `schema`. Callers do:
 *   const parsed = parseOrBadRequest(createSchema, await req.json())
 *   if ('error' in parsed) return parsed.error
 *   const body = parsed.data
 */
export function parseOrBadRequest<T>(
  schema: ZodType<T>,
  body: unknown
): { data: T } | { error: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: 'Invalid request', details: result.error.flatten() },
        { status: 400 }
      ),
    }
  }
  return { data: result.data }
}

/**
 * Creates an ApprovalRequest on behalf of a USER-role session and returns the
 * 202 response every call site immediately returns.
 */
const APPROVAL_LABELS: Record<ApprovalType, string> = {
  CREATE_OCCUPANCY: 'Créer un contrat',
  EDIT_OCCUPANCY: 'Modifier un contrat',
  DELETE_BILLBOARD: 'Supprimer un panneau',
  DELETE_CLIENT: 'Supprimer un client',
  EDIT_BILLBOARD: 'Modifier un panneau',
  EDIT_CLIENT: 'Modifier un client',
  DELETE_PHOTO: 'Supprimer une photo',
}

export async function createApprovalRequest(
  session: Session,
  type: ApprovalType,
  payload: object
) {
  const request = await prisma.approvalRequest.create({
    data: {
      requestedById: session.user.id,
      type,
      payload,
    },
  })

  await notifyAdmins({
    type: 'APPROVAL_REQUEST',
    title: 'Nouvelle demande d\'approbation',
    message: `${session.user.email} demande : ${APPROVAL_LABELS[type]}`,
    linkUrl: '/dashboard',
  })

  return NextResponse.json(request, { status: 202 })
}
