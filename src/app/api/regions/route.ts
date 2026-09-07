import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(regions)
}
