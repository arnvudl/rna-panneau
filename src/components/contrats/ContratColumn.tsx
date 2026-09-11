'use client'

import { useDroppable } from '@dnd-kit/core'
import { ContratCard, type KanbanContrat } from '@/components/contrats/ContratCard'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ContratStatusValue } from '@/lib/contrat-schema'
import { CONTRAT_STATUS_STYLES } from '@/lib/status-labels'

export function ContratColumn({
  status,
  label,
  contrats,
  pendingIds,
  pendingApprovalIds,
  disabled,
  onDeleted,
}: {
  status: ContratStatusValue
  label: string
  contrats: KanbanContrat[]
  pendingIds: Set<string>
  pendingApprovalIds: Set<string>
  disabled: boolean
  onDeleted?: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled })
  const styles = CONTRAT_STATUS_STYLES[status]

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-w-0 flex-col gap-2 rounded-xl border p-3 ring-1 ring-black/5 transition-colors',
        styles.columnBg,
        isOver ? 'border-primary ring-2 ring-primary/30' : 'border-transparent',
        disabled && 'opacity-60'
      )}
    >
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', styles.headerDot)} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        </div>
        <Badge variant={styles.badgeVariant}>{contrats.length}</Badge>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {contrats.map((contrat) => (
          <ContratCard
            key={contrat.id}
            contrat={contrat}
            pending={pendingIds.has(contrat.id)}
            pendingApproval={pendingApprovalIds.has(contrat.id)}
            onDeleted={onDeleted}
          />
        ))}
        {contrats.length === 0 && (
          <p className={cn('px-1 text-xs', styles.mutedText)}>Aucun contrat</p>
        )}
      </div>
    </div>
  )
}
