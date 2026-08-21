export type BillboardStatus =
  | 'AVAILABLE'
  | 'RENTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'MAINTENANCE'

const EXPIRING_SOON_WINDOW_DAYS = 30

export function deriveBillboardStatus(billboard: {
  damaged: boolean
  contracts: { status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'; endDate: Date }[]
}): BillboardStatus {
  if (billboard.damaged) return 'MAINTENANCE'

  const activeContract = billboard.contracts.find((c) => c.status === 'ACTIVE')
  if (!activeContract) return 'AVAILABLE'

  const now = new Date()
  const msUntilEnd = activeContract.endDate.getTime() - now.getTime()
  const daysUntilEnd = msUntilEnd / (24 * 60 * 60 * 1000)

  if (daysUntilEnd < 0) return 'EXPIRED'
  if (daysUntilEnd <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'
  return 'RENTED'
}
