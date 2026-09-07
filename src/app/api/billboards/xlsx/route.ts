import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { STATUS_LABELS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'
import { buildBillboardWhere } from '../where'
import { requireSession } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const params = req.nextUrl.searchParams
  const where = buildBillboardWhere(params)
  const statusFilter = params.get('status')

  const billboards = await prisma.billboard.findMany({
    where,
    include: {
      occupancies: { where: { status: 'ACTIVE' }, include: { client: true } },
      region: true,
      district: true,
      commune: true,
    },
    orderBy: { reference: 'asc' },
  })

  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))
  const filtered = statusFilter ? withStatus.filter((b) => b.status === statusFilter) : withStatus

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Panneaux')

  sheet.columns = [
    { header: 'Référence', key: 'reference', width: 14 },
    { header: 'Région', key: 'region', width: 16 },
    { header: 'District', key: 'district', width: 20 },
    { header: 'Commune', key: 'commune', width: 20 },
    { header: 'Dimension', key: 'dimension', width: 12 },
    { header: 'Faces', key: 'sides', width: 8 },
    { header: 'Statut', key: 'status', width: 14 },
    { header: 'Client(s) actif(s)', key: 'clients', width: 24 },
    { header: 'Fin de contrat', key: 'endDate', width: 16 },
    { header: 'Endommagé', key: 'damaged', width: 12 },
    { header: 'Note', key: 'note', width: 30 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const b of filtered) {
    const endDates = b.occupancies
      .map((o) => o.endDate)
      .filter((d): d is Date => d !== null)
      .sort((a, c) => a.getTime() - c.getTime())

    sheet.addRow({
      reference: b.reference,
      region: b.region?.name ?? '—',
      district: b.district?.name ?? '—',
      commune: b.commune?.name ?? '—',
      dimension: b.dimension.replace('D', '').replace('X', 'x'),
      sides: b.sides,
      status: STATUS_LABELS[b.status as BillboardStatus] ?? b.status,
      clients: b.occupancies.map((o) => o.client.name).join(', '),
      endDate: endDates[0] ? endDates[0].toLocaleDateString('fr-FR') : '',
      damaged: b.damaged ? 'Oui' : 'Non',
      note: b.note ?? '',
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="parc-panneaux.xlsx"',
    },
  })
}
