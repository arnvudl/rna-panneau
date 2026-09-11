import { cn } from '@/lib/utils'

/**
 * The one way this app renders an error string.
 *
 * Before this component there were thirteen hand-written copies of
 * `<p className="text-sm text-red-600">{error}</p>` (plus three near-identical
 * `border-red-200 bg-red-50` banner containers), which is how the red drifted
 * from `text-red-600` to `text-red-700` to `text-destructive` depending on when
 * the call site was written. Both shapes now come from here, and both draw
 * their red from the Status Vocabulary's Danger Red (DESIGN.md).
 *
 * Two variants, because the app genuinely has two kinds of error:
 * - `inline` (default) — a validation/submit message sitting under a field or
 *   at the foot of a form. Text only, no container.
 * - `banner` — a page-level load failure ("Erreur de chargement des clients")
 *   that owns a strip at the top of the page and needs a tinted container to
 *   read as a region rather than as a stray sentence.
 *
 * Renders nothing when `children` is falsy, so call sites can drop their
 * `{error && ...}` guard and just pass the possibly-null state value.
 */
export function FormError({
  children,
  variant = 'inline',
  className,
}: {
  children: React.ReactNode
  variant?: 'inline' | 'banner'
  className?: string
}) {
  if (!children) return null

  return (
    <p
      role="alert"
      className={cn(
        'text-sm font-medium text-status-danger-text',
        variant === 'banner' && 'rounded-lg bg-status-danger-bg px-4 py-3',
        className
      )}
    >
      {children}
    </p>
  )
}
