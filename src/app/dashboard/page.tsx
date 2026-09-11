import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireRole } from '@/components/layout/RoleGate'
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageShell } from '@/components/shared/PageShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { CheckCircle2, KeyRound, Clock3 } from 'lucide-react'

export default async function DashboardPage() {
  await requireRole(['DEV', 'ADMIN'])

  const billboards = await prisma.billboard.findMany({ include: { contrats: { include: { faces: true } } } })
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))

  const available = withStatus.filter((b) => b.status === 'AVAILABLE').length
  const rented = withStatus.filter((b) => b.status === 'RENTED' || b.status === 'EXPIRING_SOON').length
  const expiringSoon = withStatus.filter((b) => b.status === 'EXPIRING_SOON').length

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Tableau de bord' }]}
        title="Tableau de bord"
      />

      {/* Three tiles, stretched to fill the row — DESIGN.md, The No Dead Space Rule. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Disponibles" value={available} icon={CheckCircle2} meaning="ok" />
        <KpiCard label="En Location" value={rented} icon={KeyRound} meaning="progress" />
        <KpiCard label="Expirent Bientôt" value={expiringSoon} icon={Clock3} meaning="watch" />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-medium text-foreground">Demandes d&apos;approbation en attente</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalQueue />
        </CardContent>
      </Card>
    </PageShell>
  )
}
