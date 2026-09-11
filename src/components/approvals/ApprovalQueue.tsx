'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { APPROVAL_LABELS } from '@/lib/approval-labels'
import type { ApprovalType } from '@prisma/client'

type Approval = {
  id: string
  type: string
  requestedBy: { email: string }
  createdAt: string
  payload: Record<string, unknown>
  resolvedNames?: Record<string, string>
  before?: Record<string, unknown> | null
}

// Fields that just identify the target entity, not a proposed change —
// never worth showing in a diff.
const ID_FIELDS = new Set(['billboardId', 'clientId', 'contratId', 'photoId'])

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'object') return JSON.stringify(value)
  // ISO date strings (payload) and Date objects serialized to ISO by the API
  // (before) both match this pattern — render them the same way.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString('fr-FR')
  }
  return String(value)
}

const PAYLOAD_LABELS: Record<string, string> = {
  billboardId: 'Panneau',
  clientId: 'Client',
  contratId: 'Contrat',
  photoId: 'Photo',
  face: 'Face',
  numero: 'Référence du contrat',
  startDate: 'Début',
  endDate: 'Fin',
  status: 'Statut',
  damaged: 'Endommagé',
  note: 'Note',
  regionId: 'Région',
  districtId: 'District',
  communeId: 'Commune',
  dimension: 'Dimension',
  sides: 'Faces',
  statusOverride: 'Forçage statut',
  lat: 'Latitude',
  lng: 'Longitude',
  permitNumber: 'Autorisation',
  taxPaymentRef: 'Réf. taxe',
  name: 'Nom',
  phone: 'Téléphone',
  email: 'Email',
}

function PayloadSummary({
  payload,
  resolvedNames,
  before,
}: {
  payload: Record<string, unknown>
  resolvedNames?: Record<string, string>
  before?: Record<string, unknown> | null
}) {
  const entries = Object.entries(payload ?? {})
  if (entries.length === 0) return null

  if (before) {
    const changed = entries.filter(([key, value]) => {
      if (ID_FIELDS.has(key)) return false
      return formatFieldValue(before[key]) !== formatFieldValue(value)
    })
    if (changed.length === 0) return null
    return (
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {changed.map(([key, value]) => (
          <li key={key}>
            <span className="font-medium">{PAYLOAD_LABELS[key] ?? key}:</span>{' '}
            <span className="line-through">{formatFieldValue(before[key])}</span>{' '}
            → <span className="font-medium text-foreground">{formatFieldValue(value)}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {entries.map(([key, value]) => {
        const resolved = resolvedNames?.[key]
        const display = resolved ?? formatFieldValue(value)
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

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {approvals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div>
                <p className="font-medium">{APPROVAL_LABELS[a.type as ApprovalType] ?? a.type}</p>
                <p className="text-sm text-muted-foreground">Demandé par {a.requestedBy.email}</p>
                <PayloadSummary payload={a.payload} resolvedNames={a.resolvedNames} before={a.before} />
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
