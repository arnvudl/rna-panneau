import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BillboardRow } from '@/components/table/BillboardTable'
import type { Filters } from '@/components/table/FilterBar'

type ApiOccupancy = {
  status: string
  client?: { name?: string } | null
}

type ApiBillboard = {
  id: string
  reference: string
  region: { name: string } | null
  district: { name: string } | null
  commune: { name: string } | null
  dimension: string
  status: string
  damaged: boolean
  lat: number
  lng: number
  note?: string | null
  occupancies?: ApiOccupancy[]
}

export type BillboardWithLatLng = BillboardRow & { lat: number; lng: number }

function toRow(b: ApiBillboard): BillboardWithLatLng {
  const activeClientNames = (b.occupancies ?? [])
    .filter((o) => o.status === 'ACTIVE')
    .map((o) => o.client?.name)
    .filter((n): n is string => Boolean(n))
  return {
    id: b.id,
    reference: b.reference,
    regionName: b.region?.name ?? '—',
    districtName: b.district?.name ?? '—',
    communeName: b.commune?.name ?? null,
    dimension: b.dimension,
    status: b.status,
    damaged: b.damaged,
    lat: b.lat,
    lng: b.lng,
    note: b.note,
    activeClientNames,
  }
}

export function useBillboards(filters: Filters) {
  const router = useRouter()
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
        if (r.status === 401 || r.status === 403) {
          router.push('/login')
          return null
        }
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      })
      .then((data: ApiBillboard[] | null) => {
        if (data === null) return
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
