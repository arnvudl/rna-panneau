import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireRole } from '@/components/layout/RoleGate'
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  await requireRole(['DEV', 'ADMIN'])

  const billboards = await prisma.billboard.findMany({ include: { contracts: true } })
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))

  const available = withStatus.filter((b) => b.status === 'AVAILABLE').length
  const rented = withStatus.filter((b) => b.status === 'RENTED' || b.status === 'EXPIRING_SOON').length
  const expiringSoon = withStatus.filter((b) => b.status === 'EXPIRING_SOON').length

  const revenueByCity = withStatus.reduce<Record<string, number>>((acc, b) => {
    const active = b.contracts.find((c) => c.status === 'ACTIVE')
    if (active) acc[b.city] = (acc[b.city] ?? 0) + active.amount
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm text-slate-500">Disponibles</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{available}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-slate-500">En location</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{rented}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-slate-500">Expirent bientôt</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{expiringSoon}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revenus par ville (contrats actifs)</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {Object.entries(revenueByCity).map(([city, amount]) => (
              <li key={city} className="flex justify-between"><span>{city}</span><span>{amount.toLocaleString('fr-FR')} MGA</span></li>
            ))}
            {Object.keys(revenueByCity).length === 0 && (
              <li className="text-slate-500">Aucun contrat actif</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Demandes d&apos;approbation</CardTitle></CardHeader>
        <CardContent><ApprovalQueue /></CardContent>
      </Card>
    </div>
  )
}
