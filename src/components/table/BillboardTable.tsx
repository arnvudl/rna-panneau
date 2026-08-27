'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS } from '@/lib/status-labels'
import type { BillboardStatus } from '@/lib/status'

export type BillboardRow = {
  id: string
  reference: string
  city: string
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
}: {
  rows: BillboardRow[]
  onSelect: (id: string) => void
  selectedId?: string | null
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center text-slate-500">
        <p className="text-sm font-medium">Aucun panneau ne correspond à ces filtres.</p>
        <p className="text-xs text-slate-400">Essayez d&apos;ajuster vos critères de recherche.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Identifiant</TableHead>
          <TableHead>Ville</TableHead>
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
            className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedId === r.id ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
          >
            <TableCell className="font-medium">{r.reference}</TableCell>
            <TableCell>{r.city}</TableCell>
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
