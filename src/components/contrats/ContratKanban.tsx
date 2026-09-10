'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ContratColumn } from '@/components/contrats/ContratColumn'
import { ContratCard, type KanbanContrat } from '@/components/contrats/ContratCard'
import { ContratCreateForm } from '@/components/contrats/ContratCreateForm'
import { CONTRAT_STATUS_VALUES, isValidContratTransition, type ContratStatusValue } from '@/lib/contrat-schema'
import { CONTRAT_STATUS_LABELS } from '@/lib/status-labels'

/**
 * Applies the server response for a status-change PATCH to local state.
 * Exported (and kept pure) so the 200/400/409/202/network-error handling can
 * be unit-tested without mounting the full drag-and-drop board.
 */
export async function handlePatchResponse(
  res: Response,
  contrat: KanbanContrat
): Promise<{ nextStatut: ContratStatusValue | null; toast: { type: 'success' | 'info' | 'error'; message: string; description?: string } }> {
  if (res.status === 202) {
    return {
      nextStatut: null,
      toast: {
        type: 'info',
        message: "En attente d'approbation",
        description: 'Un administrateur doit valider ce changement de statut.',
      },
    }
  }
  if (res.ok) {
    const updated = await res.json().catch(() => null)
    const nextStatut: ContratStatusValue = updated?.statut ?? contrat.statut
    return { nextStatut, toast: { type: 'success', message: 'Statut mis à jour' } }
  }
  if (res.status === 400 || res.status === 409) {
    const body = await res.json().catch(() => null)
    return {
      nextStatut: null,
      toast: { type: 'error', message: body?.error ?? 'Transition refusée' },
    }
  }
  return { nextStatut: null, toast: { type: 'error', message: 'Erreur lors de la mise à jour du contrat' } }
}

/**
 * Computes the next set of contrat ids that should show the "pending
 * approval" indicator, given the outcome of a status-change PATCH.
 * Exported (and kept pure) so the indicator logic can be unit-tested
 * without mounting the drag-and-drop board.
 *
 * - A 202 response means the change was deferred to an admin approval:
 *   the contrat id is added, and the badge stays until either the
 *   approval resolves (a later successful transition removes it) or the
 *   board reloads (pendingApprovalIds is local state, reset on remount).
 * - A resolved transition (server returned a new statut) means any
 *   earlier pending-approval indicator for that contrat is stale.
 */
export function nextPendingApprovalIds(
  prev: Set<string>,
  contratId: string,
  result: { nextStatut: ContratStatusValue | null },
  responseStatus: number
): Set<string> {
  const next = new Set(prev)
  if (result.nextStatut) {
    next.delete(contratId)
  }
  if (responseStatus === 202) {
    next.add(contratId)
  }
  return next
}

export function ContratKanban() {
  const [contrats, setContrats] = useState<KanbanContrat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [pendingApprovalIds, setPendingApprovalIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchContrats = useCallback((signal?: AbortSignal, options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    return fetch('/api/contrats', { signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      })
      .then((data: KanbanContrat[]) => {
        setContrats(Array.isArray(data) ? data : [])
        setError(null)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Erreur de chargement des contrats')
      })
      .finally(() => {
        if (!options?.silent && !signal?.aborted) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchContrats(controller.signal)
    return () => controller.abort()
  }, [fetchContrats])

  const columns = useMemo(() => {
    const grouped = new Map<ContratStatusValue, KanbanContrat[]>()
    for (const status of CONTRAT_STATUS_VALUES) grouped.set(status, [])
    for (const contrat of contrats) {
      grouped.get(contrat.statut)?.push(contrat)
    }
    return grouped
  }, [contrats])

  const activeContrat = activeId ? contrats.find((c) => c.id === activeId) ?? null : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const contrat = contrats.find((c) => c.id === active.id)
    if (!contrat) return

    const nextStatus = over.id as ContratStatusValue
    if (nextStatus === contrat.statut) return
    if (!isValidContratTransition(contrat.statut, nextStatus)) {
      toast.error(`Transition invalide : ${CONTRAT_STATUS_LABELS[contrat.statut]} → ${CONTRAT_STATUS_LABELS[nextStatus]}`)
      return
    }

    setPendingIds((prev) => new Set(prev).add(contrat.id))
    try {
      const res = await fetch(`/api/contrats/${contrat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await handlePatchResponse(res, contrat)

      if (result.nextStatut) {
        setContrats((prev) => prev.map((c) => (c.id === contrat.id ? { ...c, statut: result.nextStatut as ContratStatusValue } : c)))
      }
      setPendingApprovalIds((prev) => nextPendingApprovalIds(prev, contrat.id, result, res.status))

      if (result.toast.type === 'success') toast.success(result.toast.message)
      else if (result.toast.type === 'info') toast.info(result.toast.message, { description: result.toast.description })
      else toast.error(result.toast.message)
    } catch {
      toast.error('Erreur réseau lors de la mise à jour du contrat')
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(contrat.id)
        return next
      })
    }
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Chargement des contrats…</p>
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>

  return (
    <>
      <div className="flex shrink-0 justify-end px-6 pb-2">
        <Button onClick={() => setCreateOpen(true)}>+ Nouveau contrat</Button>
      </div>
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-6 pt-2">
          {CONTRAT_STATUS_VALUES.map((status) => (
            <ContratColumn
              key={status}
              status={status}
              label={CONTRAT_STATUS_LABELS[status]}
              contrats={columns.get(status) ?? []}
              pendingIds={pendingIds}
              pendingApprovalIds={pendingApprovalIds}
              disabled={activeContrat ? !isValidContratTransition(activeContrat.statut, status) : false}
            />
          ))}
        </div>
        <DragOverlay>
          {activeContrat ? <ContratCard contrat={activeContrat} pending={false} /> : null}
        </DragOverlay>
      </DndContext>
      <ContratCreateForm open={createOpen} onOpenChange={setCreateOpen} onCreated={() => fetchContrats(undefined, { silent: true })} />
    </>
  )
}
