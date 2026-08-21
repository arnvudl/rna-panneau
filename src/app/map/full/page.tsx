'use client'

import { useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { Button } from '@/components/ui/button'
import { useBillboards } from '@/hooks/useBillboards'

export default function MapFullPage() {
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error, reload } = useBillboards(filters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null)

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
