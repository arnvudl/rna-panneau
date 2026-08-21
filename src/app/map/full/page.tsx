'use client'

import { useEffect, useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { Button } from '@/components/ui/button'
import type { BillboardRow } from '@/components/table/BillboardTable'

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

type BillboardApiItem = BillboardRow & { lat: number; lng: number }

function toRow(b: ApiBillboard): BillboardApiItem {
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

export default function MapFullPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [billboards, setBillboards] = useState<BillboardApiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null)
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
  }, [filters, reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  const select = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const selected = billboards.find((b) => b.id === selectedId) ?? null

  return (
    <div className="relative flex h-[calc(100vh-56px)] flex-col">
      {error && (
        <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="relative flex-1">
        <BillboardMap
          billboards={billboards}
          onSelect={select}
          selectedId={selectedId}
          onMapRightClick={(latLng) => { setPendingLatLng(latLng); setFormOpen(true) }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-slate-500">
            Chargement…
          </div>
        )}
      </div>
      <Button
        className="absolute bottom-6 right-6"
        onClick={() => { setPendingLatLng({ lat: -19, lng: 47 }); setFormOpen(true) }}
      >
        + Ajouter un panneau
      </Button>
      <BillboardDrawer billboard={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <BillboardForm open={formOpen} onOpenChange={setFormOpen} initialLatLng={pendingLatLng} onCreated={reload} />
    </div>
  )
}
