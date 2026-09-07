import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { buildBillboardWhere } from '../where'
import { requireSession } from '@/lib/api-helpers'
import { ParkSummaryPdf, type ParkSummaryRow } from '@/components/billboard/ParkSummaryPdf'
import { ParkFullPdf, type ParkFullBillboard } from '@/components/billboard/ParkFullPdf'
import { loadPdfPhoto } from '@/lib/pdf-photo'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const params = req.nextUrl.searchParams
  const mode = params.get('mode') ?? 'summary'
  if (mode !== 'summary' && mode !== 'full') {
    return NextResponse.json({ error: 'mode must be summary or full' }, { status: 400 })
  }

  const where = buildBillboardWhere(params)
  const statusFilter = params.get('status')

  const billboards = await prisma.billboard.findMany({
    where,
    include: {
      occupancies: { where: { status: 'ACTIVE' }, include: { client: true } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' }, take: 1 },
      district: true,
      region: true,
    },
    orderBy: { reference: 'asc' },
  })

  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))
  const filtered = statusFilter ? withStatus.filter((b) => b.status === statusFilter) : withStatus

  const generatedAt = new Date().toLocaleDateString('fr-FR')

  // The PDF components still take a single free-text location string. Feed them
  // the detected district (falling back to the region) until the component
  // layer is migrated to region/district/commune.
  const locationOf = (b: (typeof filtered)[number]) => b.district?.name ?? b.region?.name ?? ''

  let buffer: Buffer

  if (mode === 'summary') {
    const rows: ParkSummaryRow[] = filtered.map((b) => ({
      reference: b.reference,
      city: locationOf(b),
      dimension: b.dimension,
      sides: b.sides,
      status: b.status,
      activeClients: b.occupancies
        .map((o) => o.client.name)
        .join(', '),
      permitNumber: b.permitNumber,
      taxPaymentRef: b.taxPaymentRef,
    }))
    buffer = await renderToBuffer(ParkSummaryPdf({ rows, generatedAt }))
  } else {
    const data: ParkFullBillboard[] = await Promise.all(
      filtered.map(async (b) => ({
      reference: b.reference,
      city: locationOf(b),
      dimension: b.dimension,
      sides: b.sides,
      status: b.status,
      photo: b.photos[0] ? await loadPdfPhoto(b.photos[0].filename) : null,
      permitNumber: b.permitNumber,
      taxPaymentRef: b.taxPaymentRef,
      occupancies: b.occupancies.map((o) => ({
        clientName: o.client.name,
        face: o.face,
        contractRef: o.contractRef,
        endDate: o.endDate ? o.endDate.toLocaleDateString('fr-FR') : null,
      })),
      maintenanceRecords: b.maintenanceRecords.map((m) => ({
        date: m.date.toLocaleDateString('fr-FR'),
        type: m.type,
        comment: m.comment,
      })),
      }))
    )
    buffer = await renderToBuffer(ParkFullPdf({ billboards: data, generatedAt }))
  }

  const filename = mode === 'summary' ? 'parc-recapitulatif.pdf' : 'parc-complet.pdf'
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
