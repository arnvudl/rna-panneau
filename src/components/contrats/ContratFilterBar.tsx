'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KanbanContrat } from '@/components/contrats/ContratCard'

export type ContratFilters = {
  clientId?: string
  regionId?: string
  districtId?: string
  communeId?: string
}

type NamedOption = { id: string; name: string }

/** Sentinel value for the "Tous"/"Toutes" (clear) option in each dropdown — a
 * real id can never equal this, so it doubles as the "no filter" state. */
const ALL = '__all__'

/**
 * Client-side substring filter over the already-fetched contrat list, used by
 * the free-text search box (matches numero or client name). Exported (and
 * kept pure) so it's unit-testable in isolation, mirroring ContratKanban's
 * handlePatchResponse / ContratCreateForm's handleCreateResponse.
 */
export function filterContratsBySearch(contrats: KanbanContrat[], query: string): KanbanContrat[] {
  const q = query.trim().toLowerCase()
  if (!q) return contrats
  return contrats.filter(
    (c) => c.numero.toLowerCase().includes(q) || c.client.name.toLowerCase().includes(q)
  )
}

/** True when at least one filter or the search text is currently active. */
export function hasActiveContratFilters(filters: ContratFilters, search: string): boolean {
  return Object.values(filters).some(Boolean) || search.trim().length > 0
}

export function ContratFilterBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
}: {
  search: string
  onSearchChange: (value: string) => void
  filters: ContratFilters
  onFiltersChange: (filters: ContratFilters) => void
}) {
  const [clients, setClients] = useState<NamedOption[]>([])
  const [regions, setRegions] = useState<NamedOption[]>([])
  const [districts, setDistricts] = useState<(NamedOption & { regionId: string })[]>([])
  const [communes, setCommunes] = useState<(NamedOption & { districtId: string })[]>([])

  // Fetched once — the full lists are small at this data scale (matches
  // FilterBar.tsx's approach for the billboard table's own client/region list).
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

  // District options cascade from the selected région (or list all when none
  // is selected yet), mirroring FilterBar.tsx's region→district cascade.
  useEffect(() => {
    const url = filters.regionId ? `/api/districts?regionId=${filters.regionId}` : '/api/districts'
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [filters.regionId])

  // Commune options cascade from the selected district in turn.
  useEffect(() => {
    const url = filters.districtId ? `/api/communes?districtId=${filters.districtId}` : '/api/communes'
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCommunes(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [filters.districtId])

  const active = hasActiveContratFilters(filters, search)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Rechercher un numéro ou un client…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-56 bg-white shadow-sm"
      />

      <Select
        items={{ [ALL]: 'Tous les clients', ...Object.fromEntries(clients.map((c) => [c.id, c.name])) }}
        value={filters.clientId ?? ALL}
        onValueChange={(v: string | null) =>
          onFiltersChange({ ...filters, clientId: v && v !== ALL ? v : undefined })
        }
      >
        <SelectTrigger className="w-40 bg-white shadow-sm"><SelectValue placeholder="Tous les clients" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tous les clients</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{ [ALL]: 'Toutes les régions', ...Object.fromEntries(regions.map((r) => [r.id, r.name])) }}
        value={filters.regionId ?? ALL}
        onValueChange={(v: string | null) =>
          onFiltersChange({
            ...filters,
            regionId: v && v !== ALL ? v : undefined,
            districtId: undefined,
            communeId: undefined,
          })
        }
      >
        <SelectTrigger className="w-36 bg-white shadow-sm"><SelectValue placeholder="Toutes les régions" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Toutes les régions</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{ [ALL]: 'Tous les districts', ...Object.fromEntries(districts.map((d) => [d.id, d.name])) }}
        value={filters.districtId ?? ALL}
        onValueChange={(v: string | null) =>
          onFiltersChange({ ...filters, districtId: v && v !== ALL ? v : undefined, communeId: undefined })
        }
      >
        <SelectTrigger className="w-36 bg-white shadow-sm"><SelectValue placeholder="Tous les districts" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tous les districts</SelectItem>
          {districts.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{ [ALL]: 'Toutes les communes', ...Object.fromEntries(communes.map((c) => [c.id, c.name])) }}
        value={filters.communeId ?? ALL}
        onValueChange={(v: string | null) =>
          onFiltersChange({ ...filters, communeId: v && v !== ALL ? v : undefined })
        }
      >
        <SelectTrigger className="w-36 bg-white shadow-sm"><SelectValue placeholder="Toutes les communes" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Toutes les communes</SelectItem>
          {communes.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange('')
            onFiltersChange({})
          }}
        >
          Réinitialiser
        </Button>
      )}
    </div>
  )
}
