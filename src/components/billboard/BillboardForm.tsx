'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

export type EditableBillboard = {
  id: string
  city: string
  dimension: string
  sides: number
  note?: string | null
  lat: number
  lng: number
  permitNumber?: string | null
  taxPaymentRef?: string | null
}

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
  const [note, setNote] = useState(initial?.note ?? '')
  const [permitNumber, setPermitNumber] = useState(initial?.permitNumber ?? '')
  const [taxPaymentRef, setTaxPaymentRef] = useState(initial?.taxPaymentRef ?? '')
  const [lat, setLat] = useState(
    mode === 'create' ? props.initialLatLng?.lat?.toString() ?? '' : String(initial?.lat ?? '')
  )
  const [lng, setLng] = useState(
    mode === 'create' ? props.initialLatLng?.lng?.toString() ?? '' : String(initial?.lng ?? '')
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only the create flow's lat/lng need to re-sync from a changing prop (a
  // map right-click while the dialog is open); edit mode's initial value is
  // fixed for the lifetime of one dialog open, no effect needed there.
  useEffect(() => {
    if (mode === 'create' && props.initialLatLng) {
      setLat(String(props.initialLatLng.lat))
      setLng(String(props.initialLatLng.lng))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === 'create' ? props.initialLatLng : null])

  const submit = async () => {
    if (!lat.trim() || !lng.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/billboards' : `/api/billboards/${props.billboard.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const shared = {
        lat: Number(lat),
        lng: Number(lng),
        city: city.trim(),
        dimension,
        sides,
        permitNumber: permitNumber.trim() || (mode === 'edit' ? null : undefined),
        taxPaymentRef: taxPaymentRef.trim() || (mode === 'edit' ? null : undefined),
      }
      const body =
        mode === 'create'
          ? { ...shared, note: note.trim() || undefined }
          : { ...shared, note: note.trim() === '' ? null : note.trim() }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 202 || res.ok) {
        if (res.status === 202) {
          toast.info("Demande d'approbation envoyée", {
            description: 'Un administrateur doit valider cette modification.',
          })
        } else {
          toast.success(mode === 'create' ? 'Panneau créé' : 'Panneau modifié')
        }
        if (mode === 'create') {
          setCity('')
          setDimension('D4X3')
          setSides(1)
          setLat('')
          setLng('')
          setPermitNumber('')
          setTaxPaymentRef('')
        }
        onOpenChange(false)
        onSaved()
        return
      }
      const errBody = await res.json().catch(() => null)
      throw new Error(typeof errBody?.error === 'string' ? errBody.error : `Request failed with status ${res.status}`)
    } catch (err) {
      const fallback = mode === 'create' ? 'Erreur lors de la création du panneau' : 'Erreur lors de la modification du panneau'
      setError(err instanceof Error && !err.message.startsWith('Request failed') ? err.message : fallback)
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Latitude</Label>
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Longitude</Label>
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Ville</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Dimension</Label>
            <Select
              items={Object.fromEntries(DIMENSIONS.map((d) => [d, d]))}
              value={dimension}
              onValueChange={(v: string | null) => v && setDimension(v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Faces</Label>
            <Select
              items={{ '1': '1 face', '2': '2 faces' }}
              value={String(sides)}
              onValueChange={(v: string | null) => v && setSides(Number(v) as 1 | 2)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 face</SelectItem>
                <SelectItem value="2">2 faces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Numéro d&apos;autorisation municipale (optionnel)</Label>
            <Input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Référence taxe communale payée (optionnel)</Label>
            <Input
              placeholder="Vide si pas encore payée"
              value={taxPaymentRef}
              onChange={(e) => setTaxPaymentRef(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <textarea
              className="w-full rounded-md border border-slate-200 p-2 text-sm"
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            onClick={submit}
            className="w-full"
            disabled={submitting || !city.trim() || !lat.trim() || !lng.trim()}
          >
            {submitting ? (mode === 'create' ? 'Création…' : 'Enregistrement…') : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
