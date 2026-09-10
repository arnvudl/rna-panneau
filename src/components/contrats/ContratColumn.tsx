'use client'

import { useDroppable } from '@dnd-kit/core'
import { ContratCard, type KanbanContrat } from '@/components/contrats/ContratCard'
import { cn } from '@/lib/utils'
import type { ContratStatusValue } from '@/lib/contrat-schema'

export function ContratColumn({
  status,
  label,
  contrats,
  pendingIds,
  pendingApprovalIds,
  disabled,
}: {
  status: ContratStatusValue
  label: string
  contrats: KanbanContrat[]
  pendingIds: Set<string>
  pendingApprovalIds: Set<string>
  disabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-3 transition-colors',
        isOver ? 'border-primary bg-primary/5' : 'border-border',
        disabled && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {contrats.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {contrats.map((contrat) => (
          <ContratCard
            key={contrat.id}
            contrat={contrat}
            pending={pendingIds.has(contrat.id)}
            pendingApproval={pendingApprovalIds.has(contrat.id)}
          />
        ))}
        {contrats.length === 0 && <p className="px-1 text-xs text-muted-foreground">Aucun contrat</p>}
      </div>
    </div>
  )
}
