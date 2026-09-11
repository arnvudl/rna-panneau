'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CONTRAT_STATUS_STYLES, FACE_LABELS, isContratExpiringSoon } from '@/lib/status-labels'
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

/**
 * Applies the server response for a hard-delete DELETE to toast/state
 * behavior. Exported (and kept pure) so the 200/400/404/network-error
 * handling can be unit-tested without mounting the card, mirroring
 * ContratKanban's handlePatchResponse / ContratCreateForm's
 * handleCreateResponse.
 */
export async function handleDeleteResponse(
  res: Response
): Promise<{ deleted: boolean; toast: { type: 'success' | 'error'; message: string } }> {
  if (res.ok) {
    return { deleted: true, toast: { type: 'success', message: 'Contrat supprimé' } }
  }
  if (res.status === 400 || res.status === 404) {
    const body = await res.json().catch(() => null)
    return {
      deleted: false,
      toast: { type: 'error', message: typeof body?.error === 'string' ? body.error : 'Suppression refusée' },
    }
  }
  return { deleted: false, toast: { type: 'error', message: 'Erreur lors de la suppression du contrat' } }
}

export function ContratCard({
  contrat,
  pending,
  pendingApproval = false,
  onDeleted,
}: {
  contrat: KanbanContrat
  pending: boolean
  pendingApproval?: boolean
  /** Called after a real (2xx) hard delete, so the caller can drop it from local state. */
  onDeleted?: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contrat.id,
    disabled: pending,
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contrats/${contrat.id}`, { method: 'DELETE' })
      const result = await handleDeleteResponse(res)
      if (result.toast.type === 'success') toast.success(result.toast.message)
      else toast.error(result.toast.message)
      if (result.deleted) {
        setConfirmOpen(false)
        onDeleted?.(contrat.id)
      }
    } catch {
      toast.error('Erreur réseau lors de la suppression du contrat')
    } finally {
      setDeleting(false)
    }
  }

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const face = contrat.faces[0]?.face ?? 'BOTH'
  const dateDebut = formatDate(contrat.dateDebut)
  const dateFin = formatDate(contrat.dateFin)
  const accent = CONTRAT_STATUS_STYLES[contrat.statut].cardAccent
  const dateRangeLabel = dateDebut || dateFin ? `${dateDebut ?? '?'} → ${dateFin ?? 'indéterminée'}` : null
  const expiringSoon = isContratExpiringSoon(contrat)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      size="sm"
      className={cn(
        'gap-1 border-l-4 ring-1 ring-foreground/10 transition-opacity',
        accent,
        isDragging && 'opacity-50',
        pending ? 'cursor-wait opacity-60' : 'cursor-grab active:cursor-grabbing'
      )}
    >
      <CardContent className="space-y-2 pl-4 text-sm">
        <div className="space-y-0.5">
          <p className="text-base font-bold leading-tight text-card-foreground">{contrat.numero}</p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<p className="truncate text-muted-foreground">{contrat.client.name}</p>} />
              <TooltipContent>{contrat.client.name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<p className="truncate text-xs text-muted-foreground">{contrat.billboard.reference}</p>}
            />
            <TooltipContent>{contrat.billboard.reference}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {FACE_LABELS[face]}
          </Badge>
          {dateRangeLabel && <span className="truncate">{dateRangeLabel}</span>}
        </div>
        {(pending || pendingApproval || expiringSoon) && (
          <div className="flex flex-wrap gap-1">
            {pending && <Badge variant="outline">Mise à jour…</Badge>}
            {pendingApproval && <Badge variant="expiring">En attente d&apos;approbation</Badge>}
            {expiringSoon && <Badge variant="expiring">Échéance proche</Badge>}
          </div>
        )}
        {contrat.statut === 'DRAFT' && (
          <div className="flex justify-end pt-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmOpen(true)
                      }}
                    >
                      Supprimer
                    </Button>
                  }
                />
                <TooltipContent>
                  Seuls les contrats en brouillon peuvent être supprimés définitivement
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression ?</DialogTitle>
            <DialogDescription>
              Le contrat {contrat.numero} sera supprimé définitivement. Cette action est
              irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Confirmer la suppression'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
