'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export type ContractPanelContract = {
  id: string
  client: { name: string }
  startDate: Date
  endDate: Date
  amount: number
  status: string
}

export function ContractPanel({
  contract,
}: {
  contract: ContractPanelContract | undefined
  billboardId: string
}) {
  const router = useRouter()
  const [terminating, setTerminating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!contract) return <p className="text-sm text-slate-500">Aucun contrat en cours.</p>

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
