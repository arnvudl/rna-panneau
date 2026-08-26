'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContractForm } from '@/components/billboard/ContractForm'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { FACE_LABELS } from '@/lib/status-labels'

export type ContractPanelContract = {
  id: string
  client: { name: string }
  startDate: Date
  endDate: Date
  amount: number
  status: string
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

function ContractCard({ contract }: { contract: ContractPanelContract }) {
  const router = useRouter()
  const [terminating, setTerminating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminate = async () => {
    setTerminating(true)
    setError(null)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'TERMINATED' }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
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
      <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[contract.face]}</p>
      <p className="font-medium">{contract.client.name}</p>
      <p className="text-sm text-slate-600">
        {contract.startDate.toLocaleDateString('fr-FR')} → {contract.endDate.toLocaleDateString('fr-FR')}
      </p>
      <p className="text-sm">{contract.amount} MGA</p>
      <Button variant="outline" onClick={terminate} disabled={terminating}>
        {terminating ? 'Résiliation…' : 'Terminer le contrat'}
      </Button>
    </div>
  )
}

export function ContractPanel({
  contracts,
  billboardId,
  sides,
}: {
  contracts: ContractPanelContract[]
  billboardId: string
  sides: number
}) {
  const [formOpen, setFormOpen] = useState(false)

  const activeFaces = contracts.map((c) => ({ face: c.face }))
  const availableFaces: ('FACE_1' | 'FACE_2' | 'BOTH')[] =
    sides === 1
      ? isFaceAvailable('BOTH', activeFaces) ? ['BOTH'] : []
      : (['FACE_1', 'FACE_2', 'BOTH'] as const).filter((f) => isFaceAvailable(f, activeFaces))

  return (
    <div className="space-y-3">
      {contracts.length === 0 && <p className="text-sm text-slate-500">Aucun contrat en cours.</p>}
      {contracts.map((c) => <ContractCard key={c.id} contract={c} />)}
      {availableFaces.length > 0 && (
        <Button onClick={() => setFormOpen(true)}>+ Nouveau contrat</Button>
      )}
      <ContractForm
        open={formOpen}
        onOpenChange={setFormOpen}
        billboardId={billboardId}
        sides={sides}
        availableFaces={availableFaces}
      />
    </div>
  )
}
