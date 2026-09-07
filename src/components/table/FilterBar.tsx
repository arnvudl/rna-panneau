'use client'

import { useEffect, useState } from 'react'
import { STATUS_LABELS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'
import { cn } from '@/lib/utils'

export type Filters = {
  regionId?: string
  districtId?: string
  communeId?: string
  status?: string
  dimension?: string
  damaged?: string
  clientId?: string
}

const STATUSES: BillboardStatus[] = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']
const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

const selectClass =
  'h-9 flex-1 min-w-[95px] rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%20stroke%3D%27%2394a3b8%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27M4%206l4%204%204-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_8px_center] bg-no-repeat'

export function FilterBar({ filters, onChange, className }: { filters: Filters; onChange: (f: Filters) => void; className?: string }) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [regions, setRegions] = useState<{ id: string; name: string; code: string }[]>([])
  const [districts, setDistricts] = useState<{ id: string; name: string; regionId: string }[]>([])

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/regions')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const url = filters.regionId ? `/api/districts?regionId=${filters.regionId}` : '/api/districts'
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [filters.regionId])

  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b bg-slate-50/50 px-4 py-3 sm:px-6 sm:py-4", className)}>
      <select
        className={selectClass}
        value={filters.regionId ?? ''}
        onChange={(e) =>
          onChange({ ...filters, regionId: e.target.value || undefined, districtId: undefined })
        }
      >
        <option value="">Toutes les régions</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.districtId ?? ''}
        onChange={(e) => onChange({ ...filters, districtId: e.target.value || undefined })}
      >
        <option value="">Tous les districts</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.status ?? ''}
        onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
      >
        <option value="">Tous les statuts</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.dimension ?? ''}
        onChange={(e) => onChange({ ...filters, dimension: e.target.value || undefined })}
      >
        <option value="">Toutes dimensions</option>
        {DIMENSIONS.map((d) => (
          <option key={d} value={d}>{d.replace('D', '').replace('X', 'x')}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.damaged ?? ''}
        onChange={(e) => onChange({ ...filters, damaged: e.target.value || undefined })}
      >
        <option value="">Tous (État)</option>
        <option value="true">Endommagé</option>
        <option value="false">Bon état</option>
      </select>

      <select
        className={selectClass}
        value={filters.clientId ?? ''}
        onChange={(e) => onChange({ ...filters, clientId: e.target.value || undefined })}
      >
        <option value="">Tous les clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
