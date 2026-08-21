'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

export type EditableBillboard = { id: string; city: string; dimension: string; sides: number }

type BillboardFormProps =
  | {
      mode: 'create'
      open: boolean
      onOpenChange: (open: boolean) => void
      initialLatLng: { lat: number; lng: number } | null
      onSaved: () => void
    }
  | {
      mode: 'edit'
      open: boolean
      onOpenChange: (open: boolean) => void
      billboard: EditableBillboard
      onSaved: () => void
    }

export function BillboardForm(props: BillboardFormProps) {
  const { mode, open, onOpenChange, onSaved } = props
  const initial = mode === 'edit' ? props.billboard : null

  const [city, setCity] = useState(initial?.city ?? '')
  const [dimension, setDimension] = useState(initial?.dimension ?? 'D4X3')
  const [sides, setSides] = useState<1 | 2>(initial?.sides === 2 ? 2 : 1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (mode === 'create' && !props.initialLatLng) return
    setSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/billboards' : `/api/billboards/${props.billboard.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body =
        mode === 'create'
          ? { ...props.initialLatLng, city: city.trim(), dimension, sides }
          : { city: city.trim(), dimension, sides }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)

      if (mode === 'create') {
        setCity('')
        setDimension('D4X3')
        setSides(1)
      }
      onOpenChange(false)
      onSaved()
    } catch {
      setError(mode === 'create' ? 'Erreur lors de la création du panneau' : 'Erreur lors de la modification du panneau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Ajouter un panneau' : 'Modifier le panneau'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Ville</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Dimension</Label>
            <Select value={dimension} onValueChange={(v: string | null) => v && setDimension(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Faces</Label>
            <Select value={String(sides)} onValueChange={(v: string | null) => v && setSides(Number(v) as 1 | 2)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 face</SelectItem>
                <SelectItem value="2">2 faces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !city.trim()}>
            {submitting ? (mode === 'create' ? 'Création…' : 'Enregistrement…') : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
