import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/billboard/PhotoGallery'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { OccupancyPanel } from '@/components/billboard/OccupancyPanel'
import { HistoryTimeline } from '@/components/billboard/HistoryTimeline'
import { MaintenancePanel } from '@/components/billboard/MaintenancePanel'
import { ExportPdfButton } from '@/components/billboard/ExportPdfButton'
import { BillboardDetailActions } from '@/components/billboard/BillboardDetailActions'
import { StatusOverrideControl } from '@/components/billboard/StatusOverrideControl'

export default async function BillboardPage({ params }: { params: { id: string } }) {
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!billboard) notFound()

  const status = deriveBillboardStatus(billboard)
  const activeOccupancies = billboard.occupancies.filter((o) => o.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{billboard.reference}</h1>
          <p className="text-slate-600">{billboard.city} — {billboard.dimension} — {billboard.sides} face(s)</p>
          <p className="mt-1 text-sm text-slate-500">
            {billboard.lat.toFixed(5)}, {billboard.lng.toFixed(5)} — créé le {billboard.createdAt.toLocaleDateString('fr-FR')}
          </p>
          {billboard.permitNumber && <p className="mt-1 text-sm text-slate-500">Autorisation municipale : {billboard.permitNumber}</p>}
          <p className="mt-1 text-sm text-slate-500">
            Taxe communale : {billboard.taxPaymentRef ? `payée (réf. ${billboard.taxPaymentRef})` : 'non payée'}
          </p>
          {billboard.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">Note : {billboard.note}</p>}
        </div>
        <div className="flex gap-2">
          <BillboardDetailActions
            billboard={{
              id: billboard.id,
              city: billboard.city,
              dimension: billboard.dimension,
              sides: billboard.sides,
              note: billboard.note,
              lat: billboard.lat,
              lng: billboard.lng,
              permitNumber: billboard.permitNumber,
              taxPaymentRef: billboard.taxPaymentRef,
            }}
          />
          <ExportPdfButton billboardId={billboard.id} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={STATUS_BADGE_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
        <StatusOverrideControl billboardId={billboard.id} statusOverride={billboard.statusOverride} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PhotoGallery
          billboardId={billboard.id}
          photos={billboard.photos.map((p) => ({
            id: p.id,
            filename: p.filename,
            createdAt: p.createdAt.toISOString(),
          }))}
        />

        <Tabs defaultValue="contract">
          <TabsList>
            <TabsTrigger value="contract">Contrat en cours</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="maintenance">Entretien</TabsTrigger>
          </TabsList>
          <TabsContent value="contract">
            <OccupancyPanel occupancies={activeOccupancies} billboardId={billboard.id} sides={billboard.sides} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTimeline occupancies={billboard.occupancies} />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
