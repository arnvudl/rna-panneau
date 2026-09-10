import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatContactInfo } from '@/lib/client-format'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'
import { ContractPhotoLink } from '@/components/clients/ContractPhotoLink'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contrats: { include: { billboard: true }, orderBy: { dateDebut: 'desc' } } },
  })
  if (!client) notFound()

  return (
    <div>
      <Breadcrumbs
        segments={[
          { label: 'Accueil', href: '/dashboard' },
          { label: 'Clients', href: '/clients' },
          { label: client.name },
        ]}
      />
      <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <ClientDetailActions client={{ id: client.id, name: client.name, phone: client.phone, email: client.email }} />
      </div>
      <p className="text-slate-600">{formatContactInfo(client.phone, client.email)}</p>
      <h2 className="text-lg font-medium">Historique des contrats</h2>
      <ul className="space-y-2">
        {client.contrats.map((o) => (
          <li key={o.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Link href={`/billboards/${o.billboardId}`} className="font-medium text-blue-700">
                {o.billboard.reference}
              </Link>
              <ContractPhotoLink billboardId={o.billboardId} billboardReference={o.billboard.reference} />
            </div>
            <p className="text-sm text-slate-600">
              {o.numero ? `Contrat : ${o.numero}` : 'Sans référence'}
              {o.dateFin ? ` — jusqu'au ${new Date(o.dateFin).toLocaleDateString('fr-FR')}` : ' — durée indéterminée'}
            </p>
          </li>
        ))}
        {client.contrats.length === 0 && (
          <li className="text-sm text-slate-500">Aucun contrat</li>
        )}
      </ul>
      </div>
    </div>
  )
}
