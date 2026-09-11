import Link from 'next/link'

export type BreadcrumbSegment = {
  label: string
  /** Omit on the final (current-page) segment to render it as plain text. */
  href?: string
}

/**
 * Per-page "where am I" strip, replacing the old top navbar's active-link
 * underline. Every segment except the last is a link back to that level;
 * the last segment is the current page and renders as plain text.
 */
export function Breadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  if (segments.length === 0) return null

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 px-6 pt-4 text-sm text-muted-foreground">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1
        return (
          <span key={`${segment.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            {isLast || !segment.href ? (
              <span className="font-medium text-foreground">{segment.label}</span>
            ) : (
              <Link href={segment.href} className="transition-colors hover:text-foreground">
                {segment.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
