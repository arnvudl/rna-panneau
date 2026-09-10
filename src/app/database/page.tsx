'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { BillboardTable } from '@/components/table/BillboardTable'
import { FilterBar, type Filters } from '@/components/table/FilterBar'
import { BillboardForm } from '@/components/billboard/BillboardForm'
import { ExportParkPdfButton } from '@/components/billboard/ExportParkPdfButton'
import { StatusLegend } from '@/components/map/StatusLegend'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { useBillboards } from '@/hooks/useBillboards'
import { getPermission } from '@/lib/permissions'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export default function DatabasePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [filters, setFilters] = useState<Filters>({})
  const { billboards, loading, error, reload } = useBillboards(filters)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const canDelete = getPermission(session?.user?.role ?? 'USER', 'delete_billboard') !== 'forbidden'

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(billboards.map((b) => b.id)) : new Set())
  }

  const deleteSelected = async () => {
    if (selectedIds.size === 0 || deleting) return
    setDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/billboards/${id}`, { method: 'DELETE' }))
      )
      const approvalCount = results.filter((r) => r.status === 202).length
      const deletedCount = results.filter((r) => r.ok && r.status !== 202).length
      const failedCount = results.length - approvalCount - deletedCount

      if (deletedCount > 0) toast.success(`${deletedCount} panneau${deletedCount > 1 ? 'x' : ''} supprimé${deletedCount > 1 ? 's' : ''}`)
      if (approvalCount > 0) {
        toast.info(`${approvalCount} demande${approvalCount > 1 ? 's' : ''} d'approbation envoyée${approvalCount > 1 ? 's' : ''}`, {
          description: 'Un administrateur doit valider ces suppressions.',
        })
      }
      if (failedCount > 0) toast.error(`${failedCount} suppression${failedCount > 1 ? 's' : ''} a échoué`)

      setSelectedIds(new Set())
      reload()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Inventaire' }]} />
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Base de données</h1>
          {!loading && (
            <span className="text-sm font-medium text-slate-500">
              {billboards.length} panneau{billboards.length !== 1 ? 'x' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {canDelete && selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" disabled={deleting} onClick={() => setDeleteConfirmOpen(true)}>
              {deleting ? 'Suppression…' : `Supprimer la sélection (${selectedIds.size})`}
            </Button>
          )}
          <ExportParkPdfButton filters={filters} />
          <Button onClick={() => setFormOpen(true)} className="shadow-sm">
            + Ajouter un panneau
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
              Chargement des données…
            </div>
          ) : (
            <BillboardTable
              rows={billboards}
              onSelect={(id) => router.push(`/billboards/${id}`)}
              selectedIds={canDelete ? selectedIds : undefined}
              onToggleSelect={canDelete ? toggleSelect : undefined}
              onToggleSelectAll={canDelete ? toggleSelectAll : undefined}
            />
          )}
        </div>
      </div>

      <BillboardForm mode="create" open={formOpen} onOpenChange={setFormOpen} initialLatLng={null} onSaved={reload} />
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        entityLabel={`ces ${selectedIds.size} panneau${selectedIds.size > 1 ? 'x' : ''}`}
        entityName={String(selectedIds.size)}
        confirmLabel="Nombre de panneaux à supprimer"
        onConfirm={deleteSelected}
      />
      <StatusLegend />
      </div>
    </div>
  )
}
