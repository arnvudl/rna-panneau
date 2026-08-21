import { useEffect, useState } from 'react'
import type { BillboardRow } from '@/components/table/BillboardTable'
import type { Filters } from '@/components/table/FilterBar'

type ApiContract = {
  status: string
  client?: { name?: string } | null
}

type ApiBillboard = {
  id: string
  reference: string
  city: string
  dimension: string
  status: string
  damaged: boolean
  lat: number
  lng: number
  contracts?: ApiContract[]
}

export type BillboardWithLatLng = BillboardRow & { lat: number; lng: number }

function toRow(b: ApiBillboard): BillboardWithLatLng {
  const activeContract = b.contracts?.find((c) => c.status === 'ACTIVE')
  return {
    id: b.id,
    reference: b.reference,
    city: b.city,
    dimension: b.dimension,
    status: b.status,
    damaged: b.damaged,
    lat: b.lat,
    lng: b.lng,
    activeClientName: activeContract?.client?.name ?? undefined,
  }
}

export function useBillboards(filters: Filters) {
  const [billboards, setBillboards] = useState<BillboardWithLatLng[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) as Record<string, string>
    )
    fetch(`/api/billboards?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      })
      .then((data: ApiBillboard[]) => {
        setBillboards(Array.isArray(data) ? data.map(toRow) : [])
        setError(null)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Erreur de chargement des panneaux')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  return { billboards, loading, error, reload }
}
