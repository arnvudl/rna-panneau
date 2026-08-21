'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Filters = { status?: string; city?: string; dimension?: string; damaged?: string }

const STATUSES = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']
const DIMENSIONS = ['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']

function normalize(v: string | null): string | undefined {
  return v === 'all' || v === null ? undefined : v
}

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-3">
      <Select value={filters.status ?? 'all'} onValueChange={(v: string | null) => onChange({ ...filters, status: normalize(v) })}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.dimension ?? 'all'} onValueChange={(v: string | null) => onChange({ ...filters, dimension: normalize(v) })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Dimension" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes dimensions</SelectItem>
          {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d.replace('D', '').replace('X', 'x')}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.damaged ?? 'all'} onValueChange={(v: string | null) => onChange({ ...filters, damaged: normalize(v) })}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Endommagé" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          <SelectItem value="true">Endommagé</SelectItem>
          <SelectItem value="false">Non endommagé</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
