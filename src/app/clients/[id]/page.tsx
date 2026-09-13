import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FileText, CheckCircle2, CalendarDays } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatContactInfo } from '@/lib/client-format'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'
import { ContractPhotoLink } from '@/components/clients/ContractPhotoLink'
import { PageShell } from '@/components/shared/PageShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { Card, CardContent } from '@/components/ui/card'

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contrats: { include: { billboard: true }, orderBy: { dateDebut: 'desc' } } },
  })
  if (!client) notFound()

  const totalContrats = client.contrats.length
  const activeContrats = client.contrats.filter((o) => o.statut === 'ACTIVE').length
  const firstContratDate = client.contrats.reduce<Date | null>((earliest, o) => {
    if (!o.dateDebut) return earliest
    const date = new Date(o.dateDebut)
    return !earliest || date < earliest ? date : earliest
  }, null)

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: 'Accueil', href: '/dashboard' },
          { label: 'Clients', href: '/clients' },
          { label: client.name },
        ]}
        title={client.name}
        actions={
          <ClientDetailActions client={{ id: client.id, name: client.name, phone: client.phone, email: client.email }} />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Contrats" value={totalContrats} icon={FileText} meaning="progress" />
        <KpiCard label="Contrats actifs" value={activeContrats} icon={CheckCircle2} meaning="ok" />
        <KpiCard
          label="Premier contrat"
          value={firstContratDate ? firstContratDate.toLocaleDateString('fr-FR') : '—'}
          icon={CalendarDays}
          meaning="dormant"
        />
      </div>

      <Card>
        <CardContent>
          <p className="text-muted-foreground">{formatContactInfo(client.phone, client.email)}</p>
        </CardContent>
      </Card>

      <h2 className="text-base font-medium text-foreground">Historique des contrats</h2>
      <ul className="space-y-2">
        {client.contrats.map((o) => (
          <li key={o.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between">
              <Link href={`/billboards/${o.billboardId}`} className="font-medium text-primary">
                {o.billboard.reference}
              </Link>
              <ContractPhotoLink billboardId={o.billboardId} billboardReference={o.billboard.reference} />
            </div>
            <p className="text-sm text-muted-foreground">
              {o.numero ? `Contrat : ${o.numero}` : 'Sans référence'}
              {o.dateFin ? ` — jusqu'au ${new Date(o.dateFin).toLocaleDateString('fr-FR')}` : ' — durée indéterminée'}
            </p>
          </li>
        ))}
        {client.contrats.length === 0 && (
          <li className="text-sm text-muted-foreground">Aucun contrat</li>
        )}
      </ul>
    </PageShell>
  )
}
