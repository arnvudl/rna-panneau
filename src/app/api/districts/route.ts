import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const regionId = req.nextUrl.searchParams.get('regionId')
  const districts = await prisma.district.findMany({
    where: regionId ? { regionId } : undefined,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(districts)
}
