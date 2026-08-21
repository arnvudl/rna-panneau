import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ContractPanel } from '@/components/billboard/ContractPanel'
import { HistoryTimeline } from '@/components/billboard/HistoryTimeline'
import { MaintenancePanel } from '@/components/billboard/MaintenancePanel'
import { ExportPdfButton } from '@/components/billboard/ExportPdfButton'

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
  const activeContract = billboard.contracts.find((c) => c.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{billboard.reference}</h1>
          <p className="text-slate-600">{billboard.city} — {billboard.dimension} — {billboard.sides} face(s)</p>
        </div>
        <ExportPdfButton billboardId={billboard.id} />
      </div>

      <div className="flex gap-2">
        <Badge>{status}</Badge>
        {billboard.damaged && <Badge variant="destructive">Endommagé</Badge>}
      </div>

      {billboard.currentPhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={billboard.currentPhotoUrl} alt={billboard.reference} className="w-full rounded-xl object-cover" />
      )}

      <Tabs defaultValue="contract">
        <TabsList>
          <TabsTrigger value="contract">Contrat en cours</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="maintenance">Entretien</TabsTrigger>
        </TabsList>
        <TabsContent value="contract">
          <ContractPanel contract={activeContract} billboardId={billboard.id} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTimeline contracts={billboard.contracts} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenancePanel billboardId={billboard.id} records={billboard.maintenanceRecords} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
