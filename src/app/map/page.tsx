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
    <div className="flex h-[calc(100vh-56px)] flex-col gap-6 bg-slate-50 p-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}
      
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* MAP CONTAINER */}
        <div className="relative flex w-1/2 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
          <BillboardMap billboards={billboards} onSelect={select} selectedId={selectedId} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-slate-500 backdrop-blur-sm">
              Chargement de la carte…
            </div>
          )}
          <StatusLegend />
        </div>

        {/* TABLE CONTAINER */}
        <div className="flex w-1/2 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
          <FilterBar filters={filters} onChange={setFilters} />
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                Chargement des données…
              </div>
            ) : (
              <BillboardTable rows={billboards} onSelect={select} selectedId={selectedId} />
            )}
          </div>
        </div>
      </div>
      
      <BillboardDrawer billboard={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}
