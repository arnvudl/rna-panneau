'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OccupancyForm } from '@/components/billboard/OccupancyForm'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { FACE_LABELS } from '@/lib/status-labels'

export type OccupancyPanelOccupancy = {
  id: string
  client: { name: string }
  contractRef: string | null
  endDate: Date | null
  status: string
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

function OccupancyCard({ occupancy }: { occupancy: OccupancyPanelOccupancy }) {
  const router = useRouter()
  const [terminating, setTerminating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminate = async () => {
    setTerminating(true)
    setError(null)
    try {
      const res = await fetch(`/api/occupancies/${occupancy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'TERMINATED' }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      if (res.status === 202) {
        toast.info("Demande d'approbation envoyée", {
          description: 'Un administrateur doit valider la résiliation.',
        })
      } else {
        toast.success('Contrat résilié')
      }
      router.refresh()
    } catch {
      setError('Erreur lors de la résiliation du contrat')
    } finally {
      setTerminating(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[occupancy.face]}</p>
      <p className="font-medium">{occupancy.client.name}</p>
      {occupancy.contractRef && <p className="text-sm text-slate-600">Contrat : {occupancy.contractRef}</p>}
      <p className="text-sm text-slate-600">
        {occupancy.endDate ? `Jusqu'au ${occupancy.endDate.toLocaleDateString('fr-FR')}` : 'Durée indéterminée'}
      </p>
      <Button variant="outline" onClick={terminate} disabled={terminating}>
        {terminating ? 'Résiliation…' : 'Terminer le contrat'}
      </Button>
    </div>
  )
}

export function OccupancyPanel({
  occupancies,
  billboardId,
  sides,
}: {
  occupancies: OccupancyPanelOccupancy[]
  billboardId: string
  sides: number
}) {
  const [formOpen, setFormOpen] = useState(false)

  const activeFaces = occupancies.map((o) => ({ face: o.face }))
  const availableFaces: ('FACE_1' | 'FACE_2' | 'BOTH')[] =
    sides === 1
      ? isFaceAvailable('BOTH', activeFaces) ? ['BOTH'] : []
      : (['FACE_1', 'FACE_2', 'BOTH'] as const).filter((f) => isFaceAvailable(f, activeFaces))

  return (
    <div className="space-y-3">
      {occupancies.length === 0 && <p className="text-sm text-slate-500">Aucun contrat en cours.</p>}
      {occupancies.map((o) => <OccupancyCard key={o.id} occupancy={o} />)}
      {availableFaces.length > 0 && (
        <Button onClick={() => setFormOpen(true)}>+ Nouveau contrat</Button>
      )}
      <OccupancyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        billboardId={billboardId}
        sides={sides}
        availableFaces={availableFaces}
      />
    </div>
  )
}
