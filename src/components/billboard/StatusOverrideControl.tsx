'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_LABELS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'
import { FormError } from '@/components/shared/FormError'

const OPTIONS: BillboardStatus[] = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']

export function StatusOverrideControl({
  billboardId,
  statusOverride,
}: {
  billboardId: string
  statusOverride: BillboardStatus | null
}) {
  const router = useRouter()
  const { status } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status !== 'authenticated') return null

  const set = async (value: string | null) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/billboards/${billboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusOverride: value === 'auto' ? null : value }),
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      router.refresh()
    } catch {
      setError('Erreur lors de la mise à jour du statut')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-1">
      <FormError>{error}</FormError>
      <Select
        items={{ auto: 'Automatique', ...Object.fromEntries(OPTIONS.map((s) => [s, STATUS_LABELS[s]])) }}
        value={statusOverride ?? 'auto'}
        onValueChange={(v: string | null) => v && set(v)}
        disabled={submitting}
      >
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Automatique</SelectItem>
          {OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
