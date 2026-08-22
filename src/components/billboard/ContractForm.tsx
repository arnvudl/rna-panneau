'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Client = { id: string; name: string }
type Face = 'FACE_1' | 'FACE_2' | 'BOTH'

const FACE_SELECT_LABELS: Record<Face, string> = {
  FACE_1: 'Face 1',
  FACE_2: 'Face 2',
  BOTH: 'Les deux faces',
}

export function ContractForm({
  open,
  onOpenChange,
  billboardId,
  sides,
  availableFaces,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  billboardId: string
  sides: number
  /** Faces still free to contract on this billboard, e.g. ['FACE_2'] or ['BOTH']. */
  availableFaces: Face[]
}) {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [face, setFace] = useState<Face>(availableFaces[0] ?? 'BOTH')
  const [amount, setAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState('6')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClients = async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
    if (res.ok) setClients(await res.json())
  }

  // The dialog's `open` prop is set by the parent (ContractPanel), not by
  // user interaction with the Dialog itself, so Dialog's onOpenChange never
  // fires for that transition. Load the initial client list here instead.
  // This also resets all fields: ContractForm stays mounted across contract
  // creations (only `open` toggles), so without this, stale values (a
  // previously selected client, amount, or now-unavailable face) would
  // silently carry over into the next contract creation.
  useEffect(() => {
    if (open) {
      loadClients('')
      setFace(availableFaces[0] ?? 'BOTH')
      setClientId('')
      setAmount('')
      setDurationMonths('6')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async () => {
    if (!clientId || !amount) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billboardId,
          clientId,
          face: sides === 2 ? face : 'BOTH',
          startDate: new Date().toISOString(),
          amount: Number(amount),
          durationMonths: Number(durationMonths),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`)
      }
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du contrat')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Client</Label>
            <Input placeholder="Rechercher un client…" onChange={(e) => loadClients(e.target.value)} />
            <Select
              items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
              value={clientId}
              onValueChange={(v: string | null) => v && setClientId(v)}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {sides === 2 && (
            <div className="space-y-1">
              <Label>Face</Label>
              <Select
                items={Object.fromEntries(availableFaces.map((f) => [f, FACE_SELECT_LABELS[f]]))}
                value={face}
                onValueChange={(v: string | null) => v && setFace(v as Face)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableFaces.includes('FACE_1') && <SelectItem value="FACE_1">Face 1</SelectItem>}
                  {availableFaces.includes('FACE_2') && <SelectItem value="FACE_2">Face 2</SelectItem>}
                  {availableFaces.includes('BOTH') && <SelectItem value="BOTH">Les deux faces</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Montant (MGA)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Durée (mois)</Label>
            <Input type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !clientId || !amount}>
            {submitting ? 'Création…' : 'Créer le contrat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
