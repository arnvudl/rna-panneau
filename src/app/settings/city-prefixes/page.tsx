'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type CityPrefix = { id: string; city: string; prefix: string }

export default function CityPrefixesPage() {
  const [prefixes, setPrefixes] = useState<CityPrefix[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')
  const [prefix, setPrefix] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/city-prefixes')
      .then((r) => r.json())
      .then((data: CityPrefix[]) => setPrefixes(data))
      .finally(() => setLoading(false))
  }, [reloadToken])

  const save = async (targetCity: string, targetPrefix: string) => {
    setError(null)
    const res = await fetch('/api/city-prefixes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: targetCity, prefix: targetPrefix }),
    })
    if (!res.ok) {
      setError('Erreur lors de la sauvegarde')
      return
    }
    setCity('')
    setPrefix('')
    setReloadToken((t) => t + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Préfixes de référence par ville</h1>
      <p className="text-sm text-slate-600">
        Utilisé pour générer la référence des panneaux (ex: ANM 001 TNR). Une ville non listée ici
        utilise automatiquement ses 3 premières lettres en majuscules.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-end gap-2 rounded-lg border p-3">
        <div className="space-y-1">
          <Label>Ville</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Préfixe</Label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-24" />
        </div>
        <Button onClick={() => save(city, prefix)} disabled={!city.trim() || !prefix.trim()}>
          Ajouter / modifier
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {prefixes.map((p) => (
            <li key={p.id} className="flex items-center justify-between p-2 text-sm">
              <span>{p.city}</span>
              <Input
                defaultValue={p.prefix}
                className="w-24"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== p.prefix) {
                    save(p.city, e.target.value.trim())
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
