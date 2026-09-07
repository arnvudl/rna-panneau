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
      region: true,
      district: true,
    },
  })
  if (!billboard) notFound()

  const status = deriveBillboardStatus(billboard)
  const activeOccupancies = billboard.occupancies.filter((o) => o.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{billboard.reference}</h1>
            <Badge variant={STATUS_BADGE_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
          </div>
          <p className="text-slate-600 font-medium">{billboard.region?.name ?? '—'} — {billboard.district?.name ?? '—'} — {billboard.dimension} — {billboard.sides} face(s)</p>
          <p className="text-sm text-slate-500 mt-1">
            Créé le {billboard.createdAt.toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <BillboardDetailActions
              billboard={{
                id: billboard.id,
                reference: billboard.reference,
                regionId: billboard.regionId ?? '',
                districtId: billboard.districtId ?? '',
                regionName: billboard.region?.name ?? '—',
                districtName: billboard.district?.name ?? '—',
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
          <StatusOverrideControl billboardId={billboard.id} statusOverride={billboard.statusOverride} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Info & Photos */}
        <div className="space-y-6 md:col-span-1">
          {/* Details Card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="font-semibold text-slate-900">Informations</h2>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Coordonnées GPS</span>
                <span className="font-medium">{billboard.lat.toFixed(5)}, {billboard.lng.toFixed(5)}</span>
              </div>
              
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Autorisation Municipale</span>
                <span className="font-medium">{billboard.permitNumber || '—'}</span>
              </div>
              
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Taxe Communale</span>
                <span className="font-medium">{billboard.taxPaymentRef ? `Payée (réf: ${billboard.taxPaymentRef})` : 'Non payée'}</span>
              </div>
              
              {billboard.note && (
                <div>
                  <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Note</span>
                  <span className="whitespace-pre-wrap">{billboard.note}</span>
                </div>
              )}
            </div>
          </div>

          {/* Photo Gallery Card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-slate-900 mb-4">Photos</h2>
            <PhotoGallery
              billboardId={billboard.id}
              photos={billboard.photos.map((p) => ({
                id: p.id,
                filename: p.filename,
                createdAt: p.createdAt.toISOString(),
              }))}
            />
          </div>
        </div>

        {/* Right Column: Tabs */}
        <div className="md:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 min-h-[500px]">
            <Tabs defaultValue="contract" className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg">
                <TabsTrigger value="contract" className="rounded-md">Contrats en cours</TabsTrigger>
                <TabsTrigger value="history" className="rounded-md">Historique</TabsTrigger>
                <TabsTrigger value="maintenance" className="rounded-md">Entretien</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TabsContent value="contract" className="mt-0">
                  <OccupancyPanel occupancies={activeOccupancies} billboardId={billboard.id} sides={billboard.sides} />
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <HistoryTimeline occupancies={billboard.occupancies} />
                </TabsContent>
                <TabsContent value="maintenance" className="mt-0">
                  <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
