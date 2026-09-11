import { cn } from '@/lib/utils'

/**
 * The one page container: page background, page gutter, content width.
 *
 * The app previously had five different content widths (`max-w-2xl`,
 * `max-w-4xl`, `max-w-5xl`, `max-w-6xl` and full-bleed) and a mix of `p-6` /
 * `p-8` gutters, with `Breadcrumbs` adding its own `px-6 pt-4` on top — so no
 * two pages lined up their left edge. One recipe now: `max-w-6xl`, a 24px
 * horizontal gutter, 16px top. The gutter lives here, which is why
 * `Breadcrumbs` no longer carries padding of its own.
 *
 * Two orthogonal switches rather than a family of page types:
 *
 * - `fullBleed` — drop the max-width and let content span the viewport. For
 *   the inventory table and the Contrat Kanban, whose column/row counts are
 *   fixed and are supposed to stretch (DESIGN.md, The No Dead Space Rule).
 *   It does NOT remove the gutter; a table flush against the window edge reads
 *   as a rendering bug, not as density.
 * - `fill` — pin the page to the viewport height and let an inner pane scroll,
 *   instead of letting the document scroll. For pages built around one
 *   scrolling surface (a long table, a Kanban column, a client list).
 */
export function PageShell({
  fullBleed = false,
  fill = false,
  className,
  children,
}: {
  fullBleed?: boolean
  fill?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col bg-background px-6 pt-4 pb-6',
        fill ? 'h-screen overflow-hidden' : 'min-h-screen',
        className
      )}
    >
      <div
        className={cn(
          'flex w-full flex-1 flex-col gap-4',
          !fullBleed && 'mx-auto max-w-6xl',
          // Without min-h-0 a flex child refuses to shrink below its content
          // height, and the inner scroll pane grows the page instead of
          // scrolling itself.
          fill && 'min-h-0'
        )}
      >
        {children}
      </div>
    </div>
  )
}
