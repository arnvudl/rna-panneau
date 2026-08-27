'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BillboardTable } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { ExportParkPdfButton } from '@/components/billboard/ExportParkPdfButton'
import { StatusLegend } from '@/components/map/StatusLegend'
import { Button } from '@/components/ui/button'
import { useBillboards } from '@/hooks/useBillboards'

export default function DatabasePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error, reload } = useBillboards(filters)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col gap-6 bg-slate-50 p-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Base de données</h1>
        <div className="flex items-center gap-4">
          <ExportParkPdfButton filters={filters} />
          <Button onClick={() => setFormOpen(true)} className="shadow-sm">
            + Ajouter un panneau
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
              Chargement des données…
            </div>
          ) : (
            <BillboardTable rows={billboards} onSelect={(id) => router.push(`/billboards/${id}`)} />
          )}
        </div>
      </div>

      <BillboardForm mode="create" open={formOpen} onOpenChange={setFormOpen} initialLatLng={null} onSaved={reload} />
      <StatusLegend />
    </div>
  )
}
