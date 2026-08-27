import { FACE_LABELS } from '@/lib/status-labels'

export type HistoryTimelineOccupancy = {
  id: string
  client: { name: string }
  contractRef: string | null
  endDate: Date | null
  face: 'FACE_1' | 'FACE_2' | 'BOTH'
}

export function HistoryTimeline({ occupancies }: { occupancies: HistoryTimelineOccupancy[] }) {
  if (occupancies.length === 0) return <p className="text-sm text-slate-500">Aucun historique.</p>

  return (
    <ul className="space-y-3">
      {occupancies.map((o) => (
        <li key={o.id} className="border-l-2 border-blue-200 pl-3">
          <p className="text-xs font-semibold uppercase text-slate-400">{FACE_LABELS[o.face]}</p>
          <p className="font-medium">{o.client.name}</p>
          <p className="text-sm text-slate-600">
            {o.contractRef ? `Contrat : ${o.contractRef}` : 'Sans référence'}
            {o.endDate ? ` — jusqu'au ${o.endDate.toLocaleDateString('fr-FR')}` : ' — durée indéterminée'}
          </p>
        </li>
      ))}
    </ul>
  )
}
