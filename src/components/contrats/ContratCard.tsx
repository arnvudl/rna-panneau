'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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

export function ContratCard({
  contrat,
  pending,
  pendingApproval = false,
}: {
  contrat: KanbanContrat
  pending: boolean
  pendingApproval?: boolean
}) {
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
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      size="sm"
      className={cn(
        'gap-1 shadow-sm transition-opacity',
        isDragging && 'opacity-50',
        pending ? 'cursor-wait opacity-60' : 'cursor-grab active:cursor-grabbing'
      )}
    >
      <CardContent className="space-y-1 text-sm">
        <p className="font-semibold text-card-foreground">{contrat.numero}</p>
        <p className="text-muted-foreground">{contrat.client.name}</p>
        <p className="text-xs text-muted-foreground">
          {contrat.billboard.reference} · {FACE_LABELS[face]}
        </p>
        {(dateDebut || dateFin) && (
          <p className="text-xs text-muted-foreground/70">
            {dateDebut ?? '?'} → {dateFin ?? 'indéterminée'}
          </p>
        )}
        {pending && <Badge variant="outline">Mise à jour…</Badge>}
        {pendingApproval && <Badge variant="expiring">En attente d&apos;approbation</Badge>}
      </CardContent>
    </Card>
  )
}
