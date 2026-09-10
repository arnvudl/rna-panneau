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
  'available' | 'rented' | 'expiring' | 'destructive' | 'maintenance'
> = {
  AVAILABLE: 'available',
  RENTED: 'rented',
  EXPIRING_SOON: 'expiring',
  EXPIRED: 'destructive',
  MAINTENANCE: 'maintenance',
}

// Hex colors for non-Tailwind contexts (map markers, inline styles).
export const STATUS_COLORS: Record<BillboardStatus, string> = {
  AVAILABLE: '#16a34a',
  RENTED: '#2563eb',
  EXPIRING_SOON: '#f97316',
  EXPIRED: '#dc2626',
  MAINTENANCE: '#6b7280',
}

export const FACE_LABELS: Record<'FACE_1' | 'FACE_2' | 'BOTH', string> = {
  FACE_1: 'Face 1',
  FACE_2: 'Face 2',
  BOTH: 'Faces 1 et 2',
}

// Labels for ContratStatus, in workflow order (DRAFT -> SIGNED -> ACTIVE ->
// ENDED, with CANCELLED reachable from any non-terminal state). Used by the
// Kanban board columns.
export const CONTRAT_STATUS_LABELS: Record<'DRAFT' | 'SIGNED' | 'ACTIVE' | 'ENDED' | 'CANCELLED', string> = {
  DRAFT: 'Brouillon',
  SIGNED: 'Signé',
  ACTIVE: 'Actif',
  ENDED: 'Terminé',
  CANCELLED: 'Annulé',
}

// Per-status visual language for the Contrat Kanban board: a light column
// tint, a header dot/count-badge color, and a card left-accent-bar color —
// one color family per ContratStatus, reusing the same Tailwind color
// families already established by badge.tsx's status variants (emerald =
// healthy/active, blue = in-progress, orange = attention, slate = neutral,
// red = destructive/cancelled) rather than inventing new ad hoc colors.
export const CONTRAT_STATUS_STYLES: Record<
  'DRAFT' | 'SIGNED' | 'ACTIVE' | 'ENDED' | 'CANCELLED',
  {
    badgeVariant: 'maintenance' | 'rented' | 'available' | 'destructive'
    columnBg: string
    headerDot: string
    cardAccent: string
  }
> = {
  DRAFT: { badgeVariant: 'maintenance', columnBg: 'bg-slate-50', headerDot: 'bg-slate-400', cardAccent: 'border-l-slate-400' },
  SIGNED: { badgeVariant: 'rented', columnBg: 'bg-blue-50', headerDot: 'bg-blue-500', cardAccent: 'border-l-blue-500' },
  ACTIVE: { badgeVariant: 'available', columnBg: 'bg-emerald-50', headerDot: 'bg-emerald-500', cardAccent: 'border-l-emerald-500' },
  ENDED: { badgeVariant: 'maintenance', columnBg: 'bg-slate-100', headerDot: 'bg-slate-600', cardAccent: 'border-l-slate-600' },
  CANCELLED: { badgeVariant: 'destructive', columnBg: 'bg-red-50', headerDot: 'bg-red-500', cardAccent: 'border-l-red-500' },
}
