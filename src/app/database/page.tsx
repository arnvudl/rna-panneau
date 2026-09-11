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
import { Card } from '@/components/ui/card'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { FormError } from '@/components/shared/FormError'
import { PageShell } from '@/components/shared/PageShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { useBillboards } from '@/hooks/useBillboards'
import { getPermission } from '@/lib/permissions'

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
    // Full-bleed: the inventory table has many columns and is meant to use the
    // whole monitor (DESIGN.md, The No Dead Space Rule). `fill` keeps the
    // header and filter bar fixed while the table body scrolls.
    <PageShell fullBleed fill>
      <PageHeader
        breadcrumbs={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Inventaire' }]}
        title="Base de données"
        meta={!loading ? `${billboards.length} panneau${billboards.length !== 1 ? 'x' : ''}` : undefined}
        actions={
          <>
            {canDelete && selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" disabled={deleting} onClick={() => setDeleteConfirmOpen(true)}>
                {deleting ? 'Suppression…' : `Supprimer la sélection (${selectedIds.size})`}
              </Button>
            )}
            <ExportParkPdfButton filters={filters} />
            <Button onClick={() => setFormOpen(true)}>+ Ajouter un panneau</Button>
          </>
        }
      />

      <FormError variant="banner">{error}</FormError>

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-muted-foreground">
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
      </Card>

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
    </PageShell>
  )
}
