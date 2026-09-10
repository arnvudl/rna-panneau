'use client'

import { useDroppable } from '@dnd-kit/core'
import { ContratCard, type KanbanContrat } from '@/components/contrats/ContratCard'
import type { ContratStatusValue } from '@/lib/contrat-schema'

export function ContratColumn({
  status,
  label,
  contrats,
  pendingIds,
  disabled,
}: {
  status: ContratStatusValue
  label: string
  contrats: KanbanContrat[]
  pendingIds: Set<string>
  disabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled })

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-3 transition-colors ${
        isOver ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {contrats.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {contrats.map((contrat) => (
          <ContratCard key={contrat.id} contrat={contrat} pending={pendingIds.has(contrat.id)} />
        ))}
        {contrats.length === 0 && <p className="px-1 text-xs text-slate-400">Aucun contrat</p>}
      </div>
    </div>
  )
}
