import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * A dashboard KPI tile: muted label, a large count, and a round status-tinted
 * icon chip. The dashboard's three tiles were byte-identical apart from
 * label / icon / value / color, and each hand-rolled its own chip colors
 * (`bg-emerald-100` + `text-emerald-600`, etc.) — a fourth parallel status
 * palette on top of the three the app already had.
 *
 * `meaning` names one of the five Status Vocabulary meanings (DESIGN.md)
 * rather than a color, so a tile is declared as "this is a healthy number" or
 * "this needs attention soon" and the color follows from the vocabulary.
 */
const CHIP_CLASSES = {
  ok: 'bg-status-ok-bg text-status-ok-text',
  progress: 'bg-status-progress-bg text-status-progress-text',
  watch: 'bg-status-watch-bg text-status-watch-text',
  dormant: 'bg-status-dormant-bg text-status-dormant-text',
  danger: 'bg-status-danger-bg text-status-danger-text',
} as const

export function KpiCard({
  label,
  value,
  icon: Icon,
  meaning,
}: {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  meaning: keyof typeof CHIP_CLASSES
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn('rounded-full p-2.5', CHIP_CLASSES[meaning])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
      </CardContent>
    </Card>
  )
}
