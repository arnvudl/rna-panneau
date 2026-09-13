'use client'

import { useState } from 'react'
import { BillboardMap } from '@/components/map/BillboardMap'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardDrawer } from '@/components/billboard/BillboardDrawer'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { StatusLegend } from '@/components/map/StatusLegend'
import { Button } from '@/components/ui/button'
import { useBillboards } from '@/hooks/useBillboards'
import { FormError } from '@/components/shared/FormError'

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
    <div className="flex h-screen flex-col bg-background">
      {/* rounded-none: this banner spans a full-bleed edge-to-edge page. */}
      <FormError variant="banner" className="rounded-none px-6 py-2">
        {error}
      </FormError>

      {/* Solid Top Bar for Filters and Actions */}
      <div className="flex flex-col border-b bg-card sm:flex-row sm:items-center sm:justify-between pr-0 sm:pr-6 z-10">
        <div className="flex-1 overflow-x-auto">
          <FilterBar filters={filters} onChange={setFilters} className="border-b-0 bg-transparent" />
        </div>
        <div className="p-4 sm:p-0">
          <Button
            onClick={() => { setPendingLatLng({ lat: -19, lng: 47 }); setFormOpen(true) }}
            className="w-full sm:w-auto"
          >
            + Ajouter un panneau
          </Button>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1">
        <BillboardMap
          billboards={billboards}
          onSelect={select}
          selectedId={selectedId}
          onMapRightClick={(latLng) => { setPendingLatLng(latLng); setFormOpen(true) }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 text-sm font-medium text-foreground backdrop-blur-sm">
            <span className="rounded-lg bg-card px-4 py-2 ring-1 ring-foreground/10">Chargement de la carte…</span>
          </div>
        )}

        {/* Bottom Floating Legend */}
        <div className="pointer-events-none absolute bottom-6 left-6 z-10 hidden sm:block">
          <div className="pointer-events-auto overflow-hidden rounded-lg bg-card/95 ring-1 ring-foreground/10 backdrop-blur-sm">
            <StatusLegend />
          </div>
        </div>
      </div>

      <BillboardDrawer billboard={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <BillboardForm mode="create" open={formOpen} onOpenChange={setFormOpen} initialLatLng={pendingLatLng} onSaved={reload} />
    </div>
  )
}
