'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type CityPrefix = { id: string; city: string; prefix: string }
type RowState = { submitting: boolean; error: string | null }

export default function CityPrefixesPage() {
  const { data: session, status } = useSession()
  const canEdit = status === 'authenticated' && session?.user?.role !== 'USER'

  const [prefixes, setPrefixes] = useState<CityPrefix[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')
  const [prefix, setPrefix] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [rowState, setRowState] = useState<Record<string, RowState>>({})

  useEffect(() => {
    setLoading(true)
    fetch('/api/city-prefixes')
      .then((r) => r.json())
      .then((data: CityPrefix[]) => setPrefixes(data))
      .finally(() => setLoading(false))
  }, [reloadToken])

  const postPrefix = async (targetCity: string, targetPrefix: string) => {
    const res = await fetch('/api/city-prefixes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: targetCity, prefix: targetPrefix }),
    })
    return res.ok
  }

  const handleAdd = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const ok = await postPrefix(city, prefix)
      if (!ok) {
        setError('Erreur lors de la sauvegarde')
        return
      }
      setCity('')
      setPrefix('')
      setReloadToken((t) => t + 1)
    } finally {
      setSubmitting(false)
    }
  }

  // Save an edit to an existing row. Guarded against overlapping requests for
  // the same city: while a save is in flight for `targetCity`, the row's
  // input is disabled (see below) so a second onBlur can't fire, and this
  // check protects against any other caller re-entering for the same row.
  const saveRow = async (targetCity: string, targetPrefix: string) => {
    if (rowState[targetCity]?.submitting) return
    setRowState((s) => ({ ...s, [targetCity]: { submitting: true, error: null } }))
    try {
      const ok = await postPrefix(targetCity, targetPrefix)
      if (!ok) {
        setRowState((s) => ({ ...s, [targetCity]: { submitting: false, error: 'Erreur lors de la sauvegarde' } }))
        return
      }
      setRowState((s) => ({ ...s, [targetCity]: { submitting: false, error: null } }))
      setReloadToken((t) => t + 1)
    } catch {
      setRowState((s) => ({ ...s, [targetCity]: { submitting: false, error: 'Erreur lors de la sauvegarde' } }))
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Préfixes d&apos;identifiant par ville</h1>
      <p className="text-sm text-slate-600">
        Utilisé pour générer l&apos;identifiant des panneaux (ex: TNR 001). Une ville non listée ici
        utilise automatiquement ses 3 premières lettres en majuscules.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {canEdit && (
        <div className="flex items-end gap-2 rounded-lg border p-3">
          <div className="space-y-1">
            <Label>Ville</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1">
            <Label>Préfixe</Label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-24"
              disabled={submitting}
            />
          </div>
          <Button onClick={handleAdd} disabled={submitting || !city.trim() || !prefix.trim()}>
            {submitting ? 'Enregistrement…' : 'Ajouter / modifier'}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {prefixes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <span>{p.city}</span>
              {canEdit ? (
                <div className="flex flex-col items-end gap-1">
                  <Input
                    defaultValue={p.prefix}
                    className="w-24"
                    disabled={rowState[p.city]?.submitting}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value && value !== p.prefix) {
                        saveRow(p.city, value)
                      }
                    }}
                  />
                  {rowState[p.city]?.error && (
                    <span className="text-xs text-red-600">{rowState[p.city].error}</span>
                  )}
                </div>
              ) : (
                <span className="w-24 text-right font-mono">{p.prefix}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
