import { notFound } from 'next/navigation'
import { ImageOff } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ContractPanel } from '@/components/billboard/ContractPanel'
import { HistoryTimeline } from '@/components/billboard/HistoryTimeline'
import { MaintenancePanel } from '@/components/billboard/MaintenancePanel'
import { ExportPdfButton } from '@/components/billboard/ExportPdfButton'
import { BillboardDetailActions } from '@/components/billboard/BillboardDetailActions'
import { StatusOverrideControl } from '@/components/billboard/StatusOverrideControl'

export default async function BillboardPage({ params }: { params: { id: string } }) {
  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) notFound()

  const status = deriveBillboardStatus(billboard)
  const activeContracts = billboard.contracts.filter((c) => c.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{billboard.reference}</h1>
          <p className="text-slate-600">{billboard.city} — {billboard.dimension} — {billboard.sides} face(s)</p>
          <p className="mt-1 text-sm text-slate-500">
            {billboard.lat.toFixed(5)}, {billboard.lng.toFixed(5)} — créé le {billboard.createdAt.toLocaleDateString('fr-FR')}
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
        <div>
          {billboard.currentPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={billboard.currentPhotoUrl}
              alt={billboard.reference}
              className="aspect-video w-full rounded-xl border object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-slate-50 text-slate-400">
              <ImageOff className="h-10 w-10" />
              <p className="text-sm font-medium">Aucune photo</p>
            </div>
          )}
        </div>

        <Tabs defaultValue="contract">
          <TabsList>
            <TabsTrigger value="contract">Contrat en cours</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="maintenance">Entretien</TabsTrigger>
          </TabsList>
          <TabsContent value="contract">
            <ContractPanel contracts={activeContracts} billboardId={billboard.id} sides={billboard.sides} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTimeline contracts={billboard.contracts} />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
