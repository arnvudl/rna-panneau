'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClientForm } from '@/components/clients/ClientForm'
import { formatContactInfo } from '@/lib/client-format'
import { getPermission } from '@/lib/permissions'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

type Client = { id: string; name: string; phone: string | null; email: string | null }

export default function ClientsPage() {
  const { data: session, status } = useSession()
  const canCreate =
    status === 'authenticated' && getPermission(session?.user?.role ?? 'USER', 'create_client') !== 'forbidden'

  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/clients?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      })
      .then((data: Client[]) => {
        setClients(Array.isArray(data) ? data : [])
        setError(null)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Erreur de chargement des clients')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query, reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  return (
    <div className="flex h-screen flex-col gap-6 bg-slate-50">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Clients' }]} />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-hidden px-6 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clients</h1>
          {canCreate && (
            <Button onClick={() => setFormOpen(true)} className="shadow-sm">
              + Nouveau client
            </Button>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-6 shrink-0">
            <Input
              placeholder="Rechercher un client..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md bg-slate-50"
            />
          </div>

          {error && <p className="mb-4 shrink-0 text-sm font-medium text-red-600">{error}</p>}

          {loading ? (
            <div className="py-8 text-center text-sm font-medium text-slate-500">Chargement…</div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 rounded-lg border">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="group flex flex-col p-4 transition-colors hover:bg-slate-50">
                    <p className="font-semibold text-slate-900 group-hover:text-primary">{c.name}</p>
                    <p className="text-sm text-slate-500">{formatContactInfo(c.phone, c.email)}</p>
                  </Link>
                </li>
              ))}
              {clients.length === 0 && (
                <li className="p-8 text-center text-sm font-medium text-slate-500">Aucun client trouvé.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {canCreate && <ClientForm mode="create" open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />}
    </div>
  )
}
