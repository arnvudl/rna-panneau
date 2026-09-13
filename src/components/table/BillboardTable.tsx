'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'

export type BillboardRow = {
  id: string
  reference: string
  regionName: string
  districtName: string
  communeName?: string | null
  dimension: string
  status: string
  damaged: boolean
  activeClientNames?: string[]
  note?: string | null
}

export function BillboardTable({
  rows,
  onSelect,
  selectedId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  rows: BillboardRow[]
  onSelect: (id: string) => void
  selectedId?: string | null
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: (checked: boolean) => void
}) {
  const selectable = !!selectedIds && !!onToggleSelect
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selectedIds!.has(r.id))

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium">Aucun panneau ne correspond à ces filtres.</p>
        <p className="text-xs text-muted-foreground">Essayez d&apos;ajuster vos critères de recherche.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-10 px-4 text-center">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => onToggleSelectAll?.(checked === true)}
                aria-label="Tout sélectionner"
                className="mx-auto"
              />
            </TableHead>
          )}
          <TableHead>Identifiant</TableHead>
          <TableHead>Région</TableHead>
          <TableHead>District</TableHead>
          <TableHead>Commune</TableHead>
          <TableHead>Dimension</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Clients</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`cursor-pointer transition-all hover:bg-muted/80 ${
              selectedId === r.id ? 'bg-primary/5 hover:bg-primary/10' : ''
            }`}
          >
            {selectable && (
              <TableCell className="w-10 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds!.has(r.id)}
                  onCheckedChange={() => onToggleSelect!(r.id)}
                  aria-label={`Sélectionner ${r.reference}`}
                  className="mx-auto"
                />
              </TableCell>
            )}
            <TableCell className="font-medium text-foreground pl-4">{r.reference}</TableCell>
            <TableCell>{r.regionName}</TableCell>
            <TableCell>{r.districtName}</TableCell>
            <TableCell>{r.communeName ?? '—'}</TableCell>
            <TableCell>{r.dimension.replace('D', '').replace('X', 'x')}</TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE_VARIANTS[r.status as BillboardStatus] ?? 'outline'}>
                {STATUS_LABELS[r.status as BillboardStatus] ?? r.status}
              </Badge>
              {r.damaged && r.status !== 'MAINTENANCE' && (
                <Badge variant="destructive" className="ml-1">Endommagé</Badge>
              )}
            </TableCell>
            <TableCell>{r.activeClientNames && r.activeClientNames.length > 0 ? r.activeClientNames.join(', ') : '—'}</TableCell>
            <TableCell className="max-w-[200px] truncate" title={r.note ?? undefined}>{r.note ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
