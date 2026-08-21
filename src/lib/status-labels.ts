import type { BillboardStatus } from '@/lib/status'

export const STATUS_LABELS: Record<BillboardStatus, string> = {
  AVAILABLE: 'Disponible',
  RENTED: 'En location',
  EXPIRING_SOON: 'Expire bientôt',
  EXPIRED: 'Expiré',
  MAINTENANCE: 'Endommagé',
}

export const STATUS_BADGE_VARIANTS: Record<
  BillboardStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  AVAILABLE: 'secondary',
  RENTED: 'default',
  EXPIRING_SOON: 'outline',
  EXPIRED: 'destructive',
  MAINTENANCE: 'outline',
}

// Hex colors for non-Tailwind contexts (map markers, inline styles).
export const STATUS_COLORS: Record<BillboardStatus, string> = {
  AVAILABLE: '#16a34a',
  RENTED: '#2563eb',
  EXPIRING_SOON: '#f97316',
  EXPIRED: '#dc2626',
  MAINTENANCE: '#6b7280',
}
