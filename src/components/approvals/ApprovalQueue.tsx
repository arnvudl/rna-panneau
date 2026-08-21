'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Approval = {
  id: string
  type: string
  requestedBy: { email: string }
  createdAt: string
  payload: Record<string, unknown>
  resolvedNames?: Record<string, string>
}

const PAYLOAD_LABELS: Record<string, string> = {
  billboardId: 'Panneau',
  clientId: 'Client',
  contractId: 'Contrat',
  amount: 'Montant',
  startDate: 'Début',
  endDate: 'Fin',
  status: 'Statut',
}

function PayloadSummary({
  payload,
  resolvedNames,
}: {
  payload: Record<string, unknown>
  resolvedNames?: Record<string, string>
}) {
  const entries = Object.entries(payload ?? {})
  if (entries.length === 0) return null
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
      {entries.map(([key, value]) => {
        const resolved = resolvedNames?.[key]
        const display = resolved ?? (typeof value === 'object' ? JSON.stringify(value) : String(value))
        return (
          <li key={key}>
            <span className="font-medium">{PAYLOAD_LABELS[key] ?? key}:</span> {display}
          </li>
        )
      })}
    </ul>
  )
}

export function ApprovalQueue() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/approvals', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      })
      .then((data: Approval[]) => {
        setApprovals(Array.isArray(data) ? data : [])
        setError(null)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Erreur de chargement des demandes')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    if (processingId) return
    setProcessingId(id)
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      reload()
    } catch {
      setError("Erreur lors du traitement de la demande")
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement…</p>

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {approvals.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune demande en attente.</p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{a.type}</p>
                <p className="text-sm text-slate-500">Demandé par {a.requestedBy.email}</p>
                <PayloadSummary payload={a.payload} resolvedNames={a.resolvedNames} />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={processingId === a.id}
                  onClick={() => decide(a.id, 'APPROVED')}
                >
                  Approuver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processingId === a.id}
                  onClick={() => decide(a.id, 'REJECTED')}
                >
                  Rejeter
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
