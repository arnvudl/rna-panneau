'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isFaceAvailable, type OccupancyFace } from '@/lib/face-occupancy'
import { FormError } from '@/components/shared/FormError'

type Client = { id: string; name: string }
type Face = OccupancyFace

type Billboard = {
  id: string
  reference: string
  sides: number
  contrats: { faces: { face: Face }[] }[]
}

const FACE_SELECT_LABELS: Record<Face, string> = {
  FACE_1: 'Face 1',
  FACE_2: 'Face 2',
  BOTH: 'Les deux faces',
}

/**
 * Applies the server response for a contrat-creation POST to toast/close
 * behavior. Exported (and kept pure) so the 201/202/400/409/network-error
 * handling can be unit-tested without mounting the dialog, mirroring
 * ContratKanban's handlePatchResponse.
 */
export async function handleCreateResponse(
  res: Response
): Promise<{ created: boolean; toast: { type: 'success' | 'info' | 'error'; message: string; description?: string } }> {
  if (res.status === 202) {
    return {
      created: false,
      toast: {
        type: 'info',
        message: "Demande d'approbation envoyée",
        description: 'Un administrateur doit valider la création de ce contrat.',
      },
    }
  }
  if (res.ok) {
    return { created: true, toast: { type: 'success', message: 'Contrat créé' } }
  }
  if (res.status === 400 || res.status === 409) {
    const body = await res.json().catch(() => null)
    return {
      created: false,
      toast: { type: 'error', message: typeof body?.error === 'string' ? body.error : 'Requête invalide' },
    }
  }
  return { created: false, toast: { type: 'error', message: 'Erreur lors de la création du contrat' } }
}

export function ContratCreateForm({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a real (201) creation, so the caller can refresh the board. */
  onCreated?: () => void
}) {
  const [billboards, setBillboards] = useState<Billboard[]>([])
  const [billboardId, setBillboardId] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [face, setFace] = useState<Face>('BOTH')
  const [numero, setNumero] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [billboardQuery, setBillboardQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClients = async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
    if (res.ok) setClients(await res.json())
  }

  const loadBillboards = async () => {
    const res = await fetch('/api/billboards')
    if (res.ok) setBillboards(await res.json())
  }

  // Reset all fields whenever the dialog is (re-)opened, and load the initial
  // client/billboard lists — mirrors OccupancyForm's reset-on-open pattern so
  // stale values from a previous creation never carry over.
  useEffect(() => {
    if (open) {
      loadClients('')
      loadBillboards()
      setBillboardId('')
      setBillboardQuery('')
      setClientId('')
      setFace('BOTH')
      setNumero('')
      setStartDate('')
      setEndDate('')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const filteredBillboards = useMemo(() => {
    const q = billboardQuery.trim().toLowerCase()
    if (!q) return billboards
    return billboards.filter((b) => b.reference.toLowerCase().includes(q))
  }, [billboards, billboardQuery])

  const selectedBillboard = billboards.find((b) => b.id === billboardId) ?? null

  // Faces still free on the selected billboard, computed from its already
  // fetched ACTIVE contrats — the same precomputed-availability UX as
  // OccupancyForm/OccupancyPanel. The server still re-checks and returns 409
  // on conflict, so this is a UX nicety, not the source of truth.
  const availableFaces: Face[] = useMemo(() => {
    if (!selectedBillboard) return []
    const activeFaces = selectedBillboard.contrats.flatMap((c) => c.faces)
    if (selectedBillboard.sides === 1) {
      return isFaceAvailable('BOTH', activeFaces) ? ['BOTH'] : []
    }
    return (['FACE_1', 'FACE_2', 'BOTH'] as const).filter((f) => isFaceAvailable(f, activeFaces))
  }, [selectedBillboard])

  useEffect(() => {
    if (availableFaces.length > 0 && !availableFaces.includes(face)) {
      setFace(availableFaces[0])
    }
  }, [availableFaces, face])

  const sides = selectedBillboard?.sides ?? 1
  const canSubmit = Boolean(clientId && selectedBillboard && availableFaces.length > 0)

  const submit = async () => {
    if (!clientId || !billboardId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/contrats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billboardId,
          clientId,
          face: sides === 2 ? face : 'BOTH',
          numero: numero.trim() || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      })
      const result = await handleCreateResponse(res)

      if (result.toast.type === 'success') toast.success(result.toast.message)
      else if (result.toast.type === 'info') toast.info(result.toast.message, { description: result.toast.description })
      else toast.error(result.toast.message)

      if (result.toast.type === 'error') {
        setError(result.toast.message)
        return
      }

      onOpenChange(false)
      if (result.created) onCreated?.()
    } catch {
      const message = 'Erreur réseau lors de la création du contrat'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormError>{error}</FormError>
          <div className="space-y-1">
            <Label>Panneau</Label>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <Input
                placeholder="Tapez pour rechercher un panneau…"
                value={billboardQuery}
                onChange={(e) => setBillboardQuery(e.target.value)}
                className="bg-card"
              />
              <Select
                items={Object.fromEntries(filteredBillboards.map((b) => [b.id, b.reference]))}
                value={billboardId}
                onValueChange={(v: string | null) => v && setBillboardId(v)}
              >
                <SelectTrigger className="w-full bg-card">
                  <SelectValue placeholder="Sélectionnez un panneau dans la liste" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBillboards.length === 0 ? (
                    <SelectItem value="empty" disabled>Aucun panneau trouvé</SelectItem>
                  ) : (
                    filteredBillboards.map((b) => <SelectItem key={b.id} value={b.id}>{b.reference}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Client</Label>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <Input
                placeholder="Tapez pour rechercher un client…"
                onChange={(e) => loadClients(e.target.value)}
                className="bg-card"
              />
              <Select
                items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
                value={clientId}
                onValueChange={(v: string | null) => v && setClientId(v)}
              >
                <SelectTrigger className="w-full bg-card">
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
          {selectedBillboard && availableFaces.length === 0 && (
            <FormError>Aucune face disponible sur ce panneau.</FormError>
          )}
          {selectedBillboard && sides === 2 && availableFaces.length > 0 && (
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
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
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
          <Button onClick={submit} className="w-full" disabled={submitting || !canSubmit}>
            {submitting ? 'Création…' : 'Créer le contrat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
