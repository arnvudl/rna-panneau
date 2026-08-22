export type BillboardStatus =
  | 'AVAILABLE'
  | 'RENTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'MAINTENANCE'

const EXPIRING_SOON_WINDOW_DAYS = 30
// Most urgent first: an EXPIRED face outranks a RENTED one on the same billboard.
const STATUS_PRIORITY: Array<'EXPIRED' | 'EXPIRING_SOON' | 'RENTED'> = [
  'EXPIRED',
  'EXPIRING_SOON',
  'RENTED',
]

function faceStatus(endDate: Date): 'EXPIRED' | 'EXPIRING_SOON' | 'RENTED' {
  const daysUntilEnd = (endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  if (daysUntilEnd < 0) return 'EXPIRED'
  if (daysUntilEnd <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'
  return 'RENTED'
}

export function deriveBillboardStatus(billboard: {
  damaged: boolean
  statusOverride: BillboardStatus | null
  contracts: { status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'; endDate: Date; face: 'FACE_1' | 'FACE_2' | 'BOTH' }[]
}): BillboardStatus {
  if (billboard.statusOverride) return billboard.statusOverride
  if (billboard.damaged) return 'MAINTENANCE'

  const activeContracts = billboard.contracts.filter((c) => c.status === 'ACTIVE')
  if (activeContracts.length === 0) return 'AVAILABLE'

  const statuses = activeContracts.map((c) => faceStatus(c.endDate))
  return STATUS_PRIORITY.find((s) => statuses.includes(s)) ?? 'AVAILABLE'
}
