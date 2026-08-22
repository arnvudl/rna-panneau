import { STATUS_LABELS, STATUS_COLORS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'

const ORDER: BillboardStatus[] = ['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE']

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-white px-4 py-2 text-xs text-slate-600">
      {ORDER.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
          {STATUS_LABELS[s]}
        </span>
      ))}
    </div>
  )
}
