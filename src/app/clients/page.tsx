'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClientForm } from '@/components/clients/ClientForm'
import { formatContactInfo } from '@/lib/client-format'

type Client = { id: string; name: string; phone: string | null; email: string | null }

export default function ClientsPage() {
  const { data: session, status } = useSession()
  const canCreate = status === 'authenticated' && session?.user?.role !== 'USER'

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
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        {canCreate && <Button onClick={() => setFormOpen(true)}>+ Nouveau client</Button>}
      </div>
      <Input placeholder="Rechercher..." value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="block p-3 hover:bg-slate-50">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-500">{formatContactInfo(c.phone, c.email)}</p>
              </Link>
            </li>
          ))}
          {clients.length === 0 && <li className="p-3 text-sm text-slate-500">Aucun client</li>}
        </ul>
      )}
      {canCreate && <ClientForm mode="create" open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />}
    </div>
  )
}
