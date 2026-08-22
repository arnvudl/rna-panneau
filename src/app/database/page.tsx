'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BillboardTable } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { Button } from '@/components/ui/button'
import { useBillboards } from '@/hooks/useBillboards'

export default function DatabasePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error, reload } = useBillboards(filters)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="relative flex h-[calc(100vh-56px)] flex-col">
      {error && (
        <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Chargement…</div>
        ) : (
          <BillboardTable rows={billboards} onSelect={(id) => router.push(`/billboards/${id}`)} />
        )}
      </div>
      <Button className="absolute bottom-6 right-6" onClick={() => setFormOpen(true)}>
        + Ajouter un panneau
      </Button>
      <BillboardForm mode="create" open={formOpen} onOpenChange={setFormOpen} initialLatLng={null} onSaved={reload} />
    </div>
  )
}
