import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { generateReference } from '@/lib/reference'
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
import { buildBillboardWhere } from './where'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const where = buildBillboardWhere(req.nextUrl.searchParams)
  const billboards = await prisma.billboard.findMany({
    where,
    include: {
      contrats: { where: { statut: 'ACTIVE' }, include: { client: true, faces: true } },
      region: true,
      district: true,
      commune: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const statusFilter = req.nextUrl.searchParams.get('status')
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))
  const filtered = statusFilter ? withStatus.filter((b) => b.status === statusFilter) : withStatus

  return NextResponse.json(filtered)
}

const createSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']),
  sides: z.union([z.literal(1), z.literal(2)]),
  note: z.string().trim().max(2000).optional(),
  permitNumber: z.string().trim().max(100).optional(),
  taxPaymentRef: z.string().trim().max(200).optional(),
  regionId: z.string().optional(),
  districtId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error
  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  let regionId = body.regionId
  let districtId = body.districtId
  let communeId: string | null = null

  if (regionId && districtId) {
    // Manual fallback: the user picked region/district explicitly after auto
    // detection failed. Still try to resolve the commune for display, without
    // blocking creation when it cannot be found.
    const resolved = await resolveGeoForCoordinates(body.lat, body.lng)
    communeId = resolved?.communeId ?? null
  } else {
    const resolved = await resolveGeoForCoordinates(body.lat, body.lng)
    if (!resolved) {
      return NextResponse.json(
        {
          error: 'GEO_NOT_FOUND',
          message:
            "Impossible de déterminer la région/district à ces coordonnées. Sélectionnez-les manuellement.",
        },
        { status: 422 }
      )
    }
    regionId = resolved.regionId
    districtId = resolved.districtId
    communeId = resolved.communeId
  }

  const region = await prisma.region.findUnique({ where: { id: regionId } })
  if (!region) return NextResponse.json({ error: 'Région invalide' }, { status: 400 })

  const count = await prisma.billboard.count({ where: { regionId } })
  const reference = generateReference({ sequence: count + 1, regionCode: region.code })

  try {
    const billboard = await prisma.billboard.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        dimension: body.dimension,
        sides: body.sides,
        note: body.note,
        permitNumber: body.permitNumber,
        taxPaymentRef: body.taxPaymentRef,
        reference,
        regionId,
        districtId,
        communeId,
      },
    })
    return NextResponse.json(billboard, { status: 201 })
  } catch (err) {
    // Reference is unique; under concurrent requests for the same region the
    // count-then-create sequence can race and collide. At this project's
    // scale (3 users) a clean error is enough — no retry loop.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Collision de référence, veuillez réessayer' },
        { status: 409 }
      )
    }
    throw err
  }
}
