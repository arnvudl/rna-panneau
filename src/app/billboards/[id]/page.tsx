import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/billboard/PhotoGallery'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { OccupancyPanel } from '@/components/billboard/OccupancyPanel'
import { HistoryTimeline } from '@/components/billboard/HistoryTimeline'
import { MaintenancePanel } from '@/components/billboard/MaintenancePanel'
import { ExportPdfButton } from '@/components/billboard/ExportPdfButton'
import { BillboardDetailActions } from '@/components/billboard/BillboardDetailActions'
import { StatusOverrideControl } from '@/components/billboard/StatusOverrideControl'
import { PageShell } from '@/components/shared/PageShell'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function BillboardPage({ params }: { params: { id: string } }) {
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contrats: { include: { client: true, faces: true }, orderBy: { dateDebut: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' } },
      region: true,
      district: true,
    },
  })
  if (!billboard) notFound()

  const status = deriveBillboardStatus(billboard)
  const occupancies = billboard.contrats.map((c) => ({
    id: c.id,
    client: c.client,
    numero: c.numero,
    endDate: c.dateFin,
    status: c.statut,
    face: c.faces[0]?.face ?? ('BOTH' as const),
  }))
  const activeOccupancies = occupancies.filter((o) => o.status === 'ACTIVE')

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: 'Accueil', href: '/dashboard' },
          { label: 'Inventaire', href: '/database' },
          { label: billboard.reference },
        ]}
        title={billboard.reference}
        meta={<Badge variant={STATUS_BADGE_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>}
      />

      {/* Summary card. The reference and status badge moved up into PageHeader
          so this page's title sits where every other page's title sits; what
          remains here is the identifying detail line plus the record actions. */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-4">
        <div>
          <p className="text-muted-foreground font-medium">{billboard.region?.name ?? '—'} — {billboard.district?.name ?? '—'} — {billboard.dimension} — {billboard.sides} face(s)</p>
          <p className="text-sm text-muted-foreground mt-1">
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
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Info & Photos */}
        <div className="space-y-6 md:col-span-1">
          {/* Details Card */}
          <Card className="px-4">
            <h2 className="text-base font-medium text-foreground">Informations</h2>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs font-medium mb-1">Coordonnées GPS</span>
                <span className="font-medium">{billboard.lat.toFixed(5)}, {billboard.lng.toFixed(5)}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-xs font-medium mb-1">Autorisation Municipale</span>
                <span className="font-medium">{billboard.permitNumber || '—'}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-xs font-medium mb-1">Taxe Communale</span>
                <span className="font-medium">{billboard.taxPaymentRef ? `Payée (réf: ${billboard.taxPaymentRef})` : 'Non payée'}</span>
              </div>

              {billboard.note && (
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1">Note</span>
                  <span className="whitespace-pre-wrap">{billboard.note}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Photo Gallery Card */}
          <Card className="px-4">
            <h2 className="text-base font-medium text-foreground">Photos</h2>
            <PhotoGallery
              billboardId={billboard.id}
              photos={billboard.photos.map((p) => ({
                id: p.id,
                filename: p.filename,
                createdAt: p.createdAt.toISOString(),
              }))}
            />
          </Card>
        </div>

        {/* Right Column: Tabs */}
        <div className="md:col-span-2">
          <Card className="px-4">
            <Tabs defaultValue="contract" className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
                <TabsTrigger value="contract" className="rounded-md">Contrats en cours</TabsTrigger>
                <TabsTrigger value="history" className="rounded-md">Historique</TabsTrigger>
                <TabsTrigger value="maintenance" className="rounded-md">Entretien</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TabsContent value="contract" className="mt-0">
                  <OccupancyPanel occupancies={activeOccupancies} billboardId={billboard.id} sides={billboard.sides} />
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <HistoryTimeline occupancies={occupancies} />
                </TabsContent>
                <TabsContent value="maintenance" className="mt-0">
                  <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords} />
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
