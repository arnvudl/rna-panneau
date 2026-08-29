'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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

export function OccupancyForm({
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
  /** Faces still free to occupy on this billboard, e.g. ['FACE_2'] or ['BOTH']. */
  availableFaces: Face[]
}) {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [face, setFace] = useState<Face>(availableFaces[0] ?? 'BOTH')
  const [contractRef, setContractRef] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClients = async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
    if (res.ok) setClients(await res.json())
  }

  // The dialog's `open` prop is set by the parent (OccupancyPanel), not by
  // user interaction with the Dialog itself, so Dialog's onOpenChange never
  // fires for that transition. Load the initial client list here instead.
  // This also resets all fields: OccupancyForm stays mounted across creations
  // (only `open` toggles), so without this, stale values would silently
  // carry over into the next occupancy creation.
  useEffect(() => {
    if (open) {
      loadClients('')
      setFace(availableFaces[0] ?? 'BOTH')
      setClientId('')
      setContractRef('')
      setStartDate('')
      setEndDate('')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async () => {
    if (!clientId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/occupancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billboardId,
          clientId,
          face: sides === 2 ? face : 'BOTH',
          contractRef: contractRef.trim() || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`)
      }
      if (res.status === 202) {
        toast.info("Demande d'approbation envoyée", {
          description: 'Un administrateur doit valider la création de ce contrat.',
        })
      } else {
        toast.success('Contrat créé')
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
            <div className="rounded-lg border bg-slate-50 p-3 space-y-3 shadow-sm">
              <Input 
                placeholder="Tapez pour rechercher un client…" 
                onChange={(e) => loadClients(e.target.value)} 
                className="bg-white shadow-sm"
              />
              <Select
                items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
                value={clientId}
                onValueChange={(v: string | null) => v && setClientId(v)}
              >
                <SelectTrigger className="w-full bg-white shadow-sm">
                  <SelectValue placeholder="Sélectionnez un client dans la liste" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <SelectItem value="empty" disabled>Aucun client trouvé</SelectItem>
                  ) : (
                    clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
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
            <Label>Référence du contrat (optionnel)</Label>
            <Input
              placeholder="ex: Contrat-2026-014.pdf"
              value={contractRef}
              onChange={(e) => setContractRef(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Le contrat lui-même reste sur l&apos;ordinateur de l&apos;admin — cette référence sert juste à le retrouver.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date de début (optionnel)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Date de fin (optionnel)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !clientId}>
            {submitting ? 'Création…' : 'Créer le contrat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
