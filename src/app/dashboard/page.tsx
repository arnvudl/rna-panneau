import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireRole } from '@/components/layout/RoleGate'
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { CheckCircle2, KeyRound, Clock3 } from 'lucide-react'

export default async function DashboardPage() {
  await requireRole(['DEV', 'ADMIN'])

  const billboards = await prisma.billboard.findMany({ include: { contrats: { include: { faces: true } } } })
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))

  const available = withStatus.filter((b) => b.status === 'AVAILABLE').length
  const rented = withStatus.filter((b) => b.status === 'RENTED' || b.status === 'EXPIRING_SOON').length
  const expiringSoon = withStatus.filter((b) => b.status === 'EXPIRING_SOON').length

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Tableau de bord' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Tableau de bord</h1>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Disponibles</CardTitle>
              <div className="rounded-full bg-emerald-100 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-foreground">{available}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">En Location</CardTitle>
              <div className="rounded-full bg-blue-100 p-2">
                <KeyRound className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-foreground">{rented}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Expirent Bientôt</CardTitle>
              <div className="rounded-full bg-orange-100 p-2">
                <Clock3 className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-foreground">{expiringSoon}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base font-medium text-foreground">Demandes d&apos;approbation en attente</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalQueue />
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
