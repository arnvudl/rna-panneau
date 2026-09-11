'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type MaintenanceRecordItem = {
  id: string
  date: Date
  type: string
  comment: string | null
}

export function MaintenancePanel({
  billboardId,
  records,
}: {
  billboardId: string
  records: MaintenanceRecordItem[]
}) {
  const router = useRouter()
  const [type, setType] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!type) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billboardId, date: new Date().toISOString(), type, comment: comment || undefined }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      setType('')
      setComment('')
      router.refresh()
    } catch {
      setError("Erreur lors de l'ajout de l'intervention")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune intervention.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.id} className="text-sm">
              {r.date.toLocaleDateString('fr-FR')} — {r.type} {r.comment && `(${r.comment})`}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-lg border p-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Input placeholder="Type (ex: antirouille)" value={type} onChange={(e) => setType(e.target.value)} />
        <Textarea placeholder="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button onClick={submit} disabled={submitting || !type}>
          {submitting ? 'Ajout…' : 'Ajouter intervention'}
        </Button>
      </div>
    </div>
  )
}
