import { describe, it, expect, vi, beforeEach } from 'vitest'

const findDistrictNameAt = vi.fn()
const findCommuneNameAt = vi.fn()
const districtFindFirst = vi.fn()
const communeFindFirst = vi.fn()

vi.mock('./geo-lookup', () => ({
  findDistrictNameAt: (...args: unknown[]) => findDistrictNameAt(...args),
  findCommuneNameAt: (...args: unknown[]) => findCommuneNameAt(...args),
}))

vi.mock('./prisma', () => ({
  prisma: {
    district: { findFirst: (...args: unknown[]) => districtFindFirst(...args) },
    commune: { findFirst: (...args: unknown[]) => communeFindFirst(...args) },
  },
}))

import { resolveGeoForCoordinates } from './billboard-geo'

describe('resolveGeoForCoordinates', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns null when no district polygon contains the point', async () => {
    findDistrictNameAt.mockReturnValue(undefined)

    expect(await resolveGeoForCoordinates(-10, 40)).toBeNull()
    expect(districtFindFirst).not.toHaveBeenCalled()
  })

  it('returns null when the district name has no matching database row', async () => {
    findDistrictNameAt.mockReturnValue('Unknown District')
    districtFindFirst.mockResolvedValue(null)

    expect(await resolveGeoForCoordinates(-18.8792, 47.5079)).toBeNull()
    expect(districtFindFirst).toHaveBeenCalledWith({ where: { name: 'Unknown District' } })
    expect(communeFindFirst).not.toHaveBeenCalled()
  })

  it('resolves region, district and commune ids when all are found', async () => {
    findDistrictNameAt.mockReturnValue('Antananarivo Renivohitra')
    findCommuneNameAt.mockReturnValue('1er Arrondissement')
    districtFindFirst.mockResolvedValue({ id: 'dist-1', regionId: 'reg-1' })
    communeFindFirst.mockResolvedValue({ id: 'com-1' })

    expect(await resolveGeoForCoordinates(-18.8792, 47.5079)).toEqual({
      regionId: 'reg-1',
      districtId: 'dist-1',
      communeId: 'com-1',
    })
    expect(communeFindFirst).toHaveBeenCalledWith({
      where: { name: '1er Arrondissement', districtId: 'dist-1' },
    })
  })

  it('returns a null communeId when no commune polygon matches', async () => {
    findDistrictNameAt.mockReturnValue('Antananarivo Renivohitra')
    findCommuneNameAt.mockReturnValue(undefined)
    districtFindFirst.mockResolvedValue({ id: 'dist-1', regionId: 'reg-1' })

    expect(await resolveGeoForCoordinates(-18.8792, 47.5079)).toEqual({
      regionId: 'reg-1',
      districtId: 'dist-1',
      communeId: null,
    })
    expect(communeFindFirst).not.toHaveBeenCalled()
  })

  it('returns a null communeId when the commune name has no database row', async () => {
    findDistrictNameAt.mockReturnValue('Antananarivo Renivohitra')
    findCommuneNameAt.mockReturnValue('Ghost Commune')
    districtFindFirst.mockResolvedValue({ id: 'dist-1', regionId: 'reg-1' })
    communeFindFirst.mockResolvedValue(null)

    expect(await resolveGeoForCoordinates(-18.8792, 47.5079)).toEqual({
      regionId: 'reg-1',
      districtId: 'dist-1',
      communeId: null,
    })
  })
})
