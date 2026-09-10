import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import {
  ContratFilterBar,
  filterContratsBySearch,
  hasActiveContratFilters,
  type ContratFilters,
} from './ContratFilterBar'
import type { KanbanContrat } from './ContratCard'

const contrats: KanbanContrat[] = [
  {
    id: 'c1',
    numero: 'CTR-001',
    statut: 'DRAFT',
    dateDebut: null,
    dateFin: null,
    client: { id: 'cl1', name: 'Ambatovy' },
    billboard: { id: 'b1', reference: 'PAN-001' },
    faces: [{ face: 'BOTH' }],
  },
  {
    id: 'c2',
    numero: 'CTR-002',
    statut: 'ACTIVE',
    dateDebut: null,
    dateFin: null,
    client: { id: 'cl2', name: 'Telma' },
    billboard: { id: 'b2', reference: 'PAN-002' },
    faces: [{ face: 'FACE_1' }],
  },
]

describe('filterContratsBySearch', () => {
  it('returns the full list when the query is empty or whitespace', () => {
    expect(filterContratsBySearch(contrats, '')).toEqual(contrats)
    expect(filterContratsBySearch(contrats, '   ')).toEqual(contrats)
  })

  it('matches on numero, case-insensitively', () => {
    expect(filterContratsBySearch(contrats, 'ctr-002')).toEqual([contrats[1]])
  })

  it('matches on client name, case-insensitively', () => {
    expect(filterContratsBySearch(contrats, 'telma')).toEqual([contrats[1]])
  })

  it('matches a substring anywhere in numero or client name', () => {
    expect(filterContratsBySearch(contrats, 'ato')).toEqual([contrats[0]])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterContratsBySearch(contrats, 'zzz')).toEqual([])
  })
})

describe('hasActiveContratFilters', () => {
  it('is false with no filters and no search text', () => {
    expect(hasActiveContratFilters({}, '')).toBe(false)
    expect(hasActiveContratFilters({}, '   ')).toBe(false)
  })

  it('is true when any dropdown filter is set', () => {
    expect(hasActiveContratFilters({ clientId: 'cl1' }, '')).toBe(true)
    expect(hasActiveContratFilters({ regionId: 'r1' }, '')).toBe(true)
  })

  it('is true when search text is set even with no dropdown filters', () => {
    expect(hasActiveContratFilters({}, 'ctr')).toBe(true)
  })
})

describe('ContratFilterBar', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/clients')) {
        return new Response(JSON.stringify([{ id: 'cl1', name: 'Ambatovy' }]), { status: 200 })
      }
      if (url.includes('/api/billboards')) {
        return new Response(JSON.stringify([{ id: 'b1', reference: 'PAN-001' }]), { status: 200 })
      }
      if (url.includes('/api/regions')) {
        return new Response(JSON.stringify([{ id: 'r1', name: 'Analamanga' }]), { status: 200 })
      }
      if (url.includes('/api/districts')) {
        return new Response(JSON.stringify([{ id: 'd1', name: 'Antananarivo', regionId: 'r1' }]), { status: 200 })
      }
      if (url.includes('/api/communes')) {
        return new Response(JSON.stringify([{ id: 'co1', name: '1er Arrondissement', districtId: 'd1' }]), { status: 200 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    })
  })

  it('renders the search box and reflects the current search value', () => {
    render(
      <ContratFilterBar search="ctr" onSearchChange={vi.fn()} filters={{}} onFiltersChange={vi.fn()} />
    )
    expect(screen.getByPlaceholderText('Rechercher un numéro ou un client…')).toHaveValue('ctr')
  })

  it('calls onSearchChange as the search box is typed into', () => {
    const onSearchChange = vi.fn()
    render(
      <ContratFilterBar search="" onSearchChange={onSearchChange} filters={{}} onFiltersChange={vi.fn()} />
    )
    fireEvent.change(screen.getByPlaceholderText('Rechercher un numéro ou un client…'), {
      target: { value: 'CTR-001' },
    })
    expect(onSearchChange).toHaveBeenCalledWith('CTR-001')
  })

  it('fetches clients/billboards/regions on mount and populates the dropdowns', async () => {
    render(<ContratFilterBar search="" onSearchChange={vi.fn()} filters={{}} onFiltersChange={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Tous les clients')).toBeInTheDocument()
      expect(screen.getByText('Tous les panneaux')).toBeInTheDocument()
      expect(screen.getByText('Toutes les régions')).toBeInTheDocument()
    })
  })

  it('selecting a client fires onFiltersChange with its id', async () => {
    const onFiltersChange = vi.fn()
    render(
      <ContratFilterBar search="" onSearchChange={vi.fn()} filters={{}} onFiltersChange={onFiltersChange} />
    )
    await waitFor(() => expect(screen.getByText('Tous les clients')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Tous les clients'))
    const option = await screen.findByRole('option', { name: 'Ambatovy' })
    // base-ui's Select only commits a click-selection when it was preceded by
    // a pointerdown on the same item (guards against a stray click landing on
    // an item the pointer never actually pressed) — mirror that sequence here.
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    await waitFor(() => expect(onFiltersChange).toHaveBeenCalledWith({ clientId: 'cl1' }))
  })

  it('selecting a région clears any previously selected district/commune', async () => {
    const onFiltersChange = vi.fn()
    render(
      <ContratFilterBar
        search=""
        onSearchChange={vi.fn()}
        filters={{ districtId: 'd1', communeId: 'co1' } as ContratFilters}
        onFiltersChange={onFiltersChange}
      />
    )
    await waitFor(() => expect(screen.getByText('Toutes les régions')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Toutes les régions'))
    const option = await screen.findByRole('option', { name: 'Analamanga' })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenCalledWith({
        districtId: undefined,
        communeId: undefined,
        regionId: 'r1',
      })
    )
  })

  it('shows a "Réinitialiser" button only when a filter or search is active, and it clears both', () => {
    const onSearchChange = vi.fn()
    const onFiltersChange = vi.fn()
    const { rerender } = render(
      <ContratFilterBar search="" onSearchChange={onSearchChange} filters={{}} onFiltersChange={onFiltersChange} />
    )
    expect(screen.queryByText('Réinitialiser')).not.toBeInTheDocument()

    rerender(
      <ContratFilterBar
        search=""
        onSearchChange={onSearchChange}
        filters={{ clientId: 'cl1' }}
        onFiltersChange={onFiltersChange}
      />
    )
    fireEvent.click(screen.getByText('Réinitialiser'))
    expect(onSearchChange).toHaveBeenCalledWith('')
    expect(onFiltersChange).toHaveBeenCalledWith({})
  })
})
