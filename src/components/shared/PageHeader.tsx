import { Breadcrumbs, type BreadcrumbSegment } from '@/components/layout/Breadcrumbs'

/**
 * The one page header: breadcrumb trail, `<h1>`, an optional count/subtitle
 * beside the title, and an optional actions slot on the right.
 *
 * Nine pages each rebuilt this by hand, with the breadcrumb sometimes inside
 * and sometimes outside the content column, and title/actions rows that used
 * three different gap values. One spacing recipe now lives here.
 *
 * `meta` is the short muted string some pages show next to the title (the
 * inventory's "128 panneaux"). Anything longer belongs in the page body.
 */
export function PageHeader({
  breadcrumbs,
  title,
  meta,
  actions,
}: {
  breadcrumbs: BreadcrumbSegment[]
  title: string
  meta?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <Breadcrumbs segments={breadcrumbs} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {meta ? <span className="text-sm font-medium text-muted-foreground">{meta}</span> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
