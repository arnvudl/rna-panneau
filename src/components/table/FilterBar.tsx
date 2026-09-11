'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

/** Sentinel for the "Tous"/"Toutes" (clear) option — matches ContratFilterBar. */
const ALL = '__all__'

/**
 * One filter dropdown. The app has two filter bars; this one used to be a raw
 * `<select>` carrying its own border, background, focus ring and a base64 SVG
 * chevron, while ContratFilterBar already used the ui/select primitive — so the
 * same control looked different depending on which screen you were on. This
 * wrapper keeps the repetition down now that each dropdown is a five-element
 * composition rather than one tag.
 */
function FilterSelect({
  placeholder,
  value,
  onValueChange,
  options,
}: {
  placeholder: string
  value: string | undefined
  onValueChange: (value: string | undefined) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select
      items={{
        [ALL]: placeholder,
        ...Object.fromEntries(options.map((o) => [o.value, o.label])),
      }}
      value={value ?? ALL}
      onValueChange={(v: string | null) => onValueChange(v && v !== ALL ? v : undefined)}
    >
      <SelectTrigger className="w-auto min-w-32 shrink-0 bg-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

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

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined)

  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3 sm:px-6 sm:py-4', className)}>
      <FilterSelect
        placeholder="Toutes les régions"
        value={filters.regionId}
        onValueChange={(v) => onChange({ ...filters, regionId: v, districtId: undefined })}
        options={regions.map((r) => ({ value: r.id, label: r.name }))}
      />

      <FilterSelect
        placeholder="Tous les districts"
        value={filters.districtId}
        onValueChange={(v) => onChange({ ...filters, districtId: v })}
        options={districts.map((d) => ({ value: d.id, label: d.name }))}
      />

      <FilterSelect
        placeholder="Tous les statuts"
        value={filters.status}
        onValueChange={(v) => onChange({ ...filters, status: v })}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />

      <FilterSelect
        placeholder="Toutes dimensions"
        value={filters.dimension}
        onValueChange={(v) => onChange({ ...filters, dimension: v })}
        options={DIMENSIONS.map((d) => ({ value: d, label: d.replace('D', '').replace('X', 'x') }))}
      />

      <FilterSelect
        placeholder="Tous (État)"
        value={filters.damaged}
        onValueChange={(v) => onChange({ ...filters, damaged: v })}
        options={[
          { value: 'true', label: 'Endommagé' },
          { value: 'false', label: 'Bon état' },
        ]}
      />

      <FilterSelect
        placeholder="Tous les clients"
        value={filters.clientId}
        onValueChange={(v) => onChange({ ...filters, clientId: v })}
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
      />

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          title="Supprimer tous les filtres"
          aria-label="Supprimer tous les filtres"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
