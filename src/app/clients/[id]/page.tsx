import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatContactInfo } from '@/lib/client-format'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { occupancies: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <ClientDetailActions client={{ id: client.id, name: client.name, phone: client.phone, email: client.email }} />
      </div>
      <p className="text-slate-600">{formatContactInfo(client.phone, client.email)}</p>
      <h2 className="text-lg font-medium">Historique des contrats</h2>
      <ul className="space-y-2">
        {client.occupancies.map((o) => (
          <li key={o.id} className="rounded-lg border p-3">
            <Link href={`/billboards/${o.billboardId}`} className="font-medium text-blue-700">
              {o.billboard.reference}
            </Link>
            <p className="text-sm text-slate-600">
              {o.contractRef ? `Contrat : ${o.contractRef}` : 'Sans référence'}
              {o.endDate ? ` — jusqu'au ${new Date(o.endDate).toLocaleDateString('fr-FR')}` : ' — durée indéterminée'}
            </p>
          </li>
        ))}
        {client.occupancies.length === 0 && (
          <li className="text-sm text-slate-500">Aucun contrat</li>
        )}
      </ul>
    </div>
  )
}
