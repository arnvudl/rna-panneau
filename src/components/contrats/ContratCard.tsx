'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { FACE_LABELS } from '@/lib/status-labels'
import type { ContratStatusValue } from '@/lib/contrat-schema'

export type KanbanContrat = {
  id: string
  numero: string
  statut: ContratStatusValue
  dateDebut: string | null
  dateFin: string | null
  client: { id: string; name: string }
  billboard: { id: string; reference: string }
  faces: { face: 'FACE_1' | 'FACE_2' | 'BOTH' }[]
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR')
}

export function ContratCard({ contrat, pending }: { contrat: KanbanContrat; pending: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contrat.id,
    disabled: pending,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const face = contrat.faces[0]?.face ?? 'BOTH'
  const dateDebut = formatDate(contrat.dateDebut)
  const dateFin = formatDate(contrat.dateFin)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`space-y-1 rounded-lg border bg-white p-3 text-sm shadow-sm ${
        isDragging ? 'opacity-50' : ''
      } ${pending ? 'cursor-wait opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <p className="font-semibold text-slate-900">{contrat.numero}</p>
      <p className="text-slate-700">{contrat.client.name}</p>
      <p className="text-slate-500">
        {contrat.billboard.reference} · {FACE_LABELS[face]}
      </p>
      {(dateDebut || dateFin) && (
        <p className="text-xs text-slate-400">
          {dateDebut ?? '?'} → {dateFin ?? 'indéterminée'}
        </p>
      )}
      {pending && <p className="text-xs font-medium text-amber-600">Mise à jour…</p>}
    </div>
  )
}
