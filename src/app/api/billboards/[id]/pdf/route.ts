import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireSession } from '@/lib/api-helpers'
import { BillboardPdfDocument } from '@/components/billboard/BillboardPdfDocument'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(
    BillboardPdfDocument({
      data: {
        reference: billboard.reference,
        city: billboard.city,
        dimension: billboard.dimension,
        sides: billboard.sides,
        status: deriveBillboardStatus(billboard),
        currentPhotoUrl: billboard.currentPhotoUrl,
        contracts: billboard.contracts.map((c) => ({
          clientName: c.client.name,
          startDate: c.startDate.toLocaleDateString('fr-FR'),
          endDate: c.endDate.toLocaleDateString('fr-FR'),
          amount: c.amount,
        })),
        maintenanceRecords: billboard.maintenanceRecords.map((m) => ({
          date: m.date.toLocaleDateString('fr-FR'),
          type: m.type,
          comment: m.comment,
        })),
      },
    })
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${billboard.reference}.pdf"`,
    },
  })
}
