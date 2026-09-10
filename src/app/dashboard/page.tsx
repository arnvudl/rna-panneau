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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Tableau de bord' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tableau de bord</h1>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="rounded-xl border-slate-200 bg-white p-0 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
              <CardTitle className="text-sm font-semibold tracking-wider text-slate-500 uppercase">Disponibles</CardTitle>
              <div className="rounded-full bg-emerald-100 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <span className="text-4xl font-bold text-slate-900">{available}</span>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white p-0 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
              <CardTitle className="text-sm font-semibold tracking-wider text-slate-500 uppercase">En Location</CardTitle>
              <div className="rounded-full bg-blue-100 p-2">
                <KeyRound className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <span className="text-4xl font-bold text-slate-900">{rented}</span>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white p-0 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
              <CardTitle className="text-sm font-semibold tracking-wider text-slate-500 uppercase">Expirent Bientôt</CardTitle>
              <div className="rounded-full bg-orange-100 p-2">
                <Clock3 className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <span className="text-4xl font-bold text-slate-900">{expiringSoon}</span>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 p-6">
            <CardTitle className="text-lg font-semibold text-slate-800">Demandes d&apos;approbation en attente</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ApprovalQueue />
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
