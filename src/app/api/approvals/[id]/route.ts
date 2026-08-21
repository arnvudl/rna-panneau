import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, type ApprovalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

const patchSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const { decision } = parsed.data

  const approval = await prisma.approvalRequest.findUnique({ where: { id: params.id } })
  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (decision === 'APPROVED') {
        await applyApproval(tx, approval.type, approval.payload)
      }
      return tx.approvalRequest.update({
        where: { id: params.id },
        data: { status: decision, reviewedById: session.user.id, reviewedAt: new Date() },
      })
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Could not apply approval', code: err.code },
        { status: 400 }
      )
    }
    throw err
  }
}

async function applyApproval(
  tx: Prisma.TransactionClient,
  type: ApprovalType,
  payload: Prisma.JsonValue
) {
  const data = payload as Record<string, unknown>
  switch (type) {
    case 'CREATE_CONTRACT':
      await tx.contract.create({
        data: {
          billboardId: data.billboardId as string,
          clientId: data.clientId as string,
          startDate: new Date(data.startDate as string),
          endDate: new Date(data.endDate as string),
          amount: data.amount as number,
        },
      })
      break
    case 'EDIT_CONTRACT':
      await tx.contract.update({
        where: { id: data.contractId as string },
        data: {
          status: data.status as 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | undefined,
          endDate: data.endDate ? new Date(data.endDate as string) : undefined,
        },
      })
      break
    case 'DELETE_BILLBOARD':
      await tx.billboard.delete({ where: { id: data.billboardId as string } })
      break
    case 'EDIT_PRICE':
      // Speculative/future-proofing: no producer of this ApprovalType exists yet
      // anywhere in the codebase, but the case is implemented to match the enum.
      await tx.contract.update({
        where: { id: data.contractId as string },
        data: { amount: data.amount as number },
      })
      break
    default: {
      const _exhaustive: never = type
      throw new Error(`Unhandled ApprovalType: ${_exhaustive}`)
    }
  }
}
