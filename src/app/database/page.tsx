'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BillboardTable } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { useBillboards } from '@/hooks/useBillboards'

export default function DatabasePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error } = useBillboards(filters)

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
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
    </div>
  )
}
