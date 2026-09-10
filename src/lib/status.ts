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

// `dateFin` is informative only (no money/contract logic depends on it). A
// face with no end date is treated as rented indefinitely — it can never
// become EXPIRING_SOON or EXPIRED on its own; only a manual statusOverride or
// ending the contrat changes that.
function faceStatus(dateFin: Date | null): 'EXPIRED' | 'EXPIRING_SOON' | 'RENTED' {
  if (dateFin === null) return 'RENTED'
  const daysUntilEnd = (dateFin.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  if (daysUntilEnd < 0) return 'EXPIRED'
  if (daysUntilEnd <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'
  return 'RENTED'
}

export function deriveBillboardStatus(billboard: {
  damaged: boolean
  statusOverride: BillboardStatus | null
  contrats: {
    statut: 'DRAFT' | 'SIGNED' | 'ACTIVE' | 'ENDED' | 'CANCELLED'
    dateFin: Date | null
    faces: { face: 'FACE_1' | 'FACE_2' | 'BOTH' }[]
  }[]
}): BillboardStatus {
  if (billboard.statusOverride) return billboard.statusOverride
  if (billboard.damaged) return 'MAINTENANCE'

  const activeContrats = billboard.contrats.filter((c) => c.statut === 'ACTIVE')
  if (activeContrats.length === 0) return 'AVAILABLE'

  const statuses = activeContrats.map((c) => faceStatus(c.dateFin))
  return STATUS_PRIORITY.find((s) => statuses.includes(s)) ?? 'AVAILABLE'
}
