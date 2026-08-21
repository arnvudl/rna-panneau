'use client'

import { useEffect, useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { BillboardTable, type BillboardRow } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'

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

export default function MapPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [billboards, setBillboards] = useState<BillboardApiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) as Record<string, string>
    )
    fetch(`/api/billboards?${params}`)
      .then((r) => r.json())
      .then((data: ApiBillboard[]) => setBillboards(Array.isArray(data) ? data.map(toRow) : []))
      .finally(() => setLoading(false))
  }, [filters])

  const select = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const selected = billboards.find((b) => b.id === selectedId) ?? null

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r">
          <BillboardMap billboards={billboards} onSelect={select} selectedId={selectedId} />
        </div>
        <div className="w-1/2 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Chargement…</div>
          ) : (
            <BillboardTable rows={billboards} onSelect={select} selectedId={selectedId} />
          )}
        </div>
      </div>
      <BillboardDrawer billboard={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}
