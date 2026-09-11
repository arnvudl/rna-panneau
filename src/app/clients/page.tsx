'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
    <div className="flex h-screen flex-col gap-6 bg-background">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Clients' }]} />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-hidden px-6 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          {canCreate && <Button onClick={() => setFormOpen(true)}>+ Nouveau client</Button>}
        </div>

        <Card className="flex flex-1 flex-col overflow-hidden px-4">
          <div className="shrink-0">
            <Input
              placeholder="Rechercher un client..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md bg-background"
            />
          </div>

          {error && <p className="shrink-0 text-sm font-medium text-destructive">{error}</p>}

          {loading ? (
            <div className="py-8 text-center text-sm font-medium text-muted-foreground">Chargement…</div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-border rounded-lg border">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="group flex flex-col p-4 transition-colors hover:bg-muted">
                    <p className="font-medium text-foreground group-hover:text-primary">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{formatContactInfo(c.phone, c.email)}</p>
                  </Link>
                </li>
              ))}
              {clients.length === 0 && (
                <li className="p-8 text-center text-sm font-medium text-muted-foreground">Aucun client trouvé.</li>
              )}
            </ul>
          )}
        </Card>
      </div>

      {canCreate && <ClientForm mode="create" open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />}
    </div>
  )
}
