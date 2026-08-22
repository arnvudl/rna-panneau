import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatContactInfo } from '@/lib/client-format'

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contracts: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{client.name}</h1>
      <p className="text-slate-600">{formatContactInfo(client.phone, client.email)}</p>
      <h2 className="text-lg font-medium">Historique des contrats</h2>
      <ul className="space-y-2">
        {client.contracts.map((c) => (
          <li key={c.id} className="rounded-lg border p-3">
            <Link href={`/billboards/${c.billboardId}`} className="font-medium text-blue-700">
              {c.billboard.reference}
            </Link>
            <p className="text-sm text-slate-600">
              {new Date(c.startDate).toLocaleDateString('fr-FR')} → {new Date(c.endDate).toLocaleDateString('fr-FR')} — {c.amount} MGA
            </p>
          </li>
        ))}
        {client.contracts.length === 0 && (
          <li className="text-sm text-slate-500">Aucun contrat</li>
        )}
      </ul>
    </div>
  )
}
