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

// Solid status color for the two non-Tailwind call sites (map markers,
// StatusLegend dots), which set it through an inline `style` rather than a
// class. These are CSS var references, not literal hexes, so they resolve to
// the same Status Vocabulary defined once in src/app/globals.css — there is no
// second list of status hexes to keep in sync any more. The *text* (solid) half
// of each pair is used, since a marker is a small solid dot that needs the
// saturated color, not the pale badge background.
export const STATUS_COLORS: Record<BillboardStatus, string> = {
  AVAILABLE: 'var(--status-ok-text)',
  RENTED: 'var(--status-progress-text)',
  EXPIRING_SOON: 'var(--status-watch-text)',
  EXPIRED: 'var(--status-danger-text)',
  MAINTENANCE: 'var(--status-dormant-text)',
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

// Per-status visual language for the Contrat Kanban board: a faint column
// tint, a header dot color, and the column's empty-state muted-text color.
//
// Every value here is drawn from the one Status Vocabulary (globals.css /
// tailwind.config.ts) rather than from an ad hoc Tailwind palette step: the
// column wash is the meaning's `-tint`, and the dot / empty-state text are its
// solid `-text`. Previously these were hand-picked `-50`/`-400`/`-500`/`-600`
// steps that drifted from the badge colors sitting right next to them in the
// same column header.
//
// A `cardAccent` field used to live here too (a `border-l-*` color for each
// card's left accent bar), but DESIGN.md's No Side-Tabs Rule retired that
// pattern: status on the card is now carried entirely by the column's own
// tint, so there is nothing left for a per-status card class to do.
//
// mutedText is now the status's own `-text` everywhere rather than the shared
// muted-foreground token: `-text` is the darkest half of each pair and clears
// WCAG AA comfortably on that pair's own `-tint` wash, which also removes the
// CANCELLED-only contrast exception the previous version needed.
//
// Keeping all four fields on one map (rather than parallel Records keyed by
// the same statuses) means a future status is added in exactly one place.
export const CONTRAT_STATUS_STYLES: Record<
  'DRAFT' | 'SIGNED' | 'ACTIVE' | 'ENDED' | 'CANCELLED',
  {
    badgeVariant: 'maintenance' | 'rented' | 'available' | 'destructive'
    columnBg: string
    headerDot: string
    mutedText: string
  }
> = {
  // DRAFT and ENDED intentionally share Dormant Slate: DESIGN.md assigns both
  // "a draft not yet started" and "a contract that ended normally" to that one
  // meaning. They used to differ by a half-step of slate (50 vs 100, 400 vs
  // 600), which implied a distinction the vocabulary does not make; the column
  // label and header dot position still tell them apart.
  DRAFT: { badgeVariant: 'maintenance', columnBg: 'bg-status-dormant-tint', headerDot: 'bg-status-dormant-text', mutedText: 'text-status-dormant-text' },
  SIGNED: { badgeVariant: 'rented', columnBg: 'bg-status-progress-tint', headerDot: 'bg-status-progress-text', mutedText: 'text-status-progress-text' },
  ACTIVE: { badgeVariant: 'available', columnBg: 'bg-status-ok-tint', headerDot: 'bg-status-ok-text', mutedText: 'text-status-ok-text' },
  ENDED: { badgeVariant: 'maintenance', columnBg: 'bg-status-dormant-tint', headerDot: 'bg-status-dormant-text', mutedText: 'text-status-dormant-text' },
  CANCELLED: { badgeVariant: 'destructive', columnBg: 'bg-status-danger-tint', headerDot: 'bg-status-danger-text', mutedText: 'text-status-danger-text' },
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
