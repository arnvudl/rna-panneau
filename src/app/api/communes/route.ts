import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const districtId = req.nextUrl.searchParams.get('districtId')
  const communes = await prisma.commune.findMany({
    where: districtId ? { districtId } : undefined,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(communes)
}
