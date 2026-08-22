'use client'

import { useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { BillboardTable } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'
import { StatusLegend } from '@/components/map/StatusLegend'
import { useBillboards } from '@/hooks/useBillboards'

export default function MapPage() {
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error } = useBillboards(filters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const select = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const selected = billboards.find((b) => b.id === selectedId) ?? null

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {error && (
        <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative w-1/2 border-r">
          <BillboardMap billboards={billboards} onSelect={select} selectedId={selectedId} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-slate-500">
              Chargement…
            </div>
          )}
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
      <StatusLegend />
    </div>
  )
}
