import { describe, it, expect } from 'vitest'
import { filterContratsBySearch, hasActiveContratFilters, type ContratFilters } from './ContratFilterBar'
import type { KanbanContrat } from './ContratCard'

describe('filterContratsBySearch', () => {
  const mockContrats: KanbanContrat[] = [
    {
      id: 'c1',
      numero: 'CONT-001',
      statut: 'ACTIVE',
      dateDebut: '2024-01-01',
      dateFin: '2024-12-31',
      client: { id: 'cli1', name: 'Acme Corp' },
      billboard: { id: 'bb1', reference: 'BB-001' },
      faces: [{ face: 'BOTH' }],
    },
    {
      id: 'c2',
      numero: 'CONT-002',
      statut: 'DRAFT',
      dateDebut: '2024-02-01',
      dateFin: null,
      client: { id: 'cli2', name: 'Beta Industries' },
      billboard: { id: 'bb2', reference: 'BB-002' },
      faces: [{ face: 'FACE_1' }],
    },
    {
      id: 'c3',
      numero: 'CONT-003',
      statut: 'ACTIVE',
      dateDebut: '2024-03-01',
      dateFin: '2025-03-01',
      client: { id: 'cli3', name: 'Gamma LLC' },
      billboard: { id: 'bb3', reference: 'BB-003' },
      faces: [{ face: 'FACE_2' }],
    },
  ]

  it('returns all contrats when search query is empty', () => {
    const result = filterContratsBySearch(mockContrats, '')
    expect(result).toEqual(mockContrats)
  })

  it('returns all contrats when search query is only whitespace', () => {
    const result = filterContratsBySearch(mockContrats, '   ')
    expect(result).toEqual(mockContrats)
  })

  it('filters by numero (case-insensitive)', () => {
    const result = filterContratsBySearch(mockContrats, 'CONT-001')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('filters by numero with partial match (case-insensitive)', () => {
    const result = filterContratsBySearch(mockContrats, 'cont-00')
    expect(result).toHaveLength(3)
  })

  it('filters by numero with lowercase query', () => {
    const result = filterContratsBySearch(mockContrats, 'cont-002')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c2')
  })

  it('filters by client name (case-insensitive)', () => {
    const result = filterContratsBySearch(mockContrats, 'Acme')
    expect(result).toHaveLength(1)
    expect(result[0].client.name).toBe('Acme Corp')
  })

  it('filters by client name with partial match', () => {
    const result = filterContratsBySearch(mockContrats, 'Industries')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c2')
  })

  it('filters by client name with lowercase query', () => {
    const result = filterContratsBySearch(mockContrats, 'gamma')
    expect(result).toHaveLength(1)
    expect(result[0].client.name).toBe('Gamma LLC')
  })

  it('returns empty array when no matches found', () => {
    const result = filterContratsBySearch(mockContrats, 'NonExistentQuery')
    expect(result).toHaveLength(0)
  })

  it('handles empty contrat list', () => {
    const result = filterContratsBySearch([], 'anything')
    expect(result).toHaveLength(0)
  })

  it('matches both numero and client name', () => {
    // This contrat has numero that contains "002" and client name "Beta"
    const result = filterContratsBySearch(mockContrats, '002')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c2')

    const result2 = filterContratsBySearch(mockContrats, 'Beta')
    expect(result2).toHaveLength(1)
    expect(result2[0].id).toBe('c2')
  })
})

describe('hasActiveContratFilters', () => {
  it('returns false when no filters and no search', () => {
    const result = hasActiveContratFilters({}, '')
    expect(result).toBe(false)
  })

  it('returns false when filters are undefined/empty and search is empty', () => {
    const result = hasActiveContratFilters(
      { clientId: undefined, billboardId: undefined },
      ''
    )
    expect(result).toBe(false)
  })

  it('returns true when clientId filter is set', () => {
    const result = hasActiveContratFilters({ clientId: 'cli1' }, '')
    expect(result).toBe(true)
  })

  it('returns true when billboardId filter is set', () => {
    const result = hasActiveContratFilters({ billboardId: 'bb1' }, '')
    expect(result).toBe(true)
  })

  it('returns true when regionId filter is set', () => {
    const result = hasActiveContratFilters({ regionId: 'r1' }, '')
    expect(result).toBe(true)
  })

  it('returns true when districtId filter is set', () => {
    const result = hasActiveContratFilters({ districtId: 'd1' }, '')
    expect(result).toBe(true)
  })

  it('returns true when communeId filter is set', () => {
    const result = hasActiveContratFilters({ communeId: 'co1' }, '')
    expect(result).toBe(true)
  })

  it('returns true when search text is set', () => {
    const result = hasActiveContratFilters({}, 'search term')
    expect(result).toBe(true)
  })

  it('returns true when search text is whitespace-only (should be trimmed)', () => {
    const result = hasActiveContratFilters({}, '   ')
    expect(result).toBe(false)
  })

  it('returns true when multiple filters are active', () => {
    const filters: ContratFilters = { clientId: 'cli1', regionId: 'r1' }
    const result = hasActiveContratFilters(filters, 'search')
    expect(result).toBe(true)
  })
})
