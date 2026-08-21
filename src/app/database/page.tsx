'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BillboardTable, type BillboardRow } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'

export default function DatabasePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>({})
  const [billboards, setBillboards] = useState<BillboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      .then((data: BillboardRow[]) => {
        setBillboards(Array.isArray(data) ? data : [])
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
  }, [filters])

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
