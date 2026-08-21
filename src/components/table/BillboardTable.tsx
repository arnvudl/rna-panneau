'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export type BillboardRow = {
  id: string
  reference: string
  city: string
  dimension: string
  status: string
  damaged: boolean
  activeClientName?: string
}

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  RENTED: 'Loué',
  EXPIRING_SOON: 'Bientôt expiré',
  EXPIRED: 'Expiré',
  MAINTENANCE: 'Maintenance',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AVAILABLE: 'secondary',
  RENTED: 'default',
  EXPIRING_SOON: 'outline',
  EXPIRED: 'destructive',
  MAINTENANCE: 'outline',
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
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">
        Aucun panneau ne correspond à ces filtres.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Référence</TableHead>
          <TableHead>Ville</TableHead>
          <TableHead>Dimension</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Client</TableHead>
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
              <Badge variant={STATUS_VARIANTS[r.status] ?? 'outline'}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
              {r.damaged && <Badge variant="destructive" className="ml-1">Endommagé</Badge>}
            </TableCell>
            <TableCell>{r.activeClientName ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
