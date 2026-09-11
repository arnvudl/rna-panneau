import type { BillboardStatus } from '@/lib/status'
import { EXPIRING_SOON_WINDOW_DAYS } from '@/lib/status'
import type { ContratStatusValue } from '@/lib/contrat-schema'

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
// tint, a header dot/count-badge color, a card left-accent-bar color, and the
// column's empty-state muted-text color — one color family per ContratStatus,
// reusing the same Tailwind color families already established by badge.tsx's
// status variants (emerald = healthy/active, blue = in-progress, orange =
// attention, slate = neutral, red = destructive/cancelled) rather than
// inventing new ad hoc colors. Keeping all four fields on one map (rather
// than a second parallel Record keyed by the same statuses) means a future
// status only has to be added in one place.
//
// mutedText: text-muted-foreground (#64748b) reads at ~4.35:1 on the
// CANCELLED column's bg-red-50 tint — just under WCAG AA's 4.5:1 minimum for
// body text. Every other column tint stays legible with the shared
// muted-foreground token, so only CANCELLED gets a darker, status-specific
// override (mirroring the danger-text color badge.tsx's own destructive
// variant already uses) rather than darkening muted-foreground globally.
export const CONTRAT_STATUS_STYLES: Record<
  'DRAFT' | 'SIGNED' | 'ACTIVE' | 'ENDED' | 'CANCELLED',
  {
    badgeVariant: 'maintenance' | 'rented' | 'available' | 'destructive'
    columnBg: string
    headerDot: string
    cardAccent: string
    mutedText: string
  }
> = {
  DRAFT: { badgeVariant: 'maintenance', columnBg: 'bg-slate-50', headerDot: 'bg-slate-400', cardAccent: 'border-l-slate-400', mutedText: 'text-muted-foreground' },
  SIGNED: { badgeVariant: 'rented', columnBg: 'bg-blue-50', headerDot: 'bg-blue-500', cardAccent: 'border-l-blue-500', mutedText: 'text-muted-foreground' },
  ACTIVE: { badgeVariant: 'available', columnBg: 'bg-emerald-50', headerDot: 'bg-emerald-500', cardAccent: 'border-l-emerald-500', mutedText: 'text-muted-foreground' },
  ENDED: { badgeVariant: 'maintenance', columnBg: 'bg-slate-100', headerDot: 'bg-slate-600', cardAccent: 'border-l-slate-600', mutedText: 'text-muted-foreground' },
  CANCELLED: { badgeVariant: 'destructive', columnBg: 'bg-red-50', headerDot: 'bg-red-500', cardAccent: 'border-l-red-500', mutedText: 'text-red-700' },
}

// Lead time (in days) before an ACTIVE contrat's dateFin at which its Kanban
// card surfaces a Watch-Orange "expiring soon" badge. Reuses the same
// EXPIRING_SOON_WINDOW_DAYS constant status.ts already uses for billboard
// face status, rather than introducing a second, possibly-diverging lead
// time for the same underlying concept.
export const CONTRAT_EXPIRING_SOON_WINDOW_DAYS = EXPIRING_SOON_WINDOW_DAYS

/**
 * Whether a Contrat's card should show the "expiring soon" badge: it must be
 * ACTIVE, have a dateFin (open-ended contrats never trigger it), and that
 * dateFin must fall within the next CONTRAT_EXPIRING_SOON_WINDOW_DAYS days
 * (not already past — an overdue ACTIVE contrat is a data anomaly outside
 * this fix's scope, not a "coming up soon" signal). Kept pure/exported so
 * the date-window logic is unit-testable without mounting ContratCard.
 */
export function isContratExpiringSoon(
  contrat: { statut: ContratStatusValue; dateFin: string | Date | null },
  now: Date = new Date()
): boolean {
  if (contrat.statut !== 'ACTIVE') return false
  if (!contrat.dateFin) return false
  const end = contrat.dateFin instanceof Date ? contrat.dateFin : new Date(contrat.dateFin)
  if (Number.isNaN(end.getTime())) return false
  const daysUntilEnd = (end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  return daysUntilEnd >= 0 && daysUntilEnd <= CONTRAT_EXPIRING_SOON_WINDOW_DAYS
}
