export type HistoryTimelineContract = {
  id: string
  client: { name: string }
  startDate: Date
  endDate: Date
  amount: number
}

export function HistoryTimeline({ contracts }: { contracts: HistoryTimelineContract[] }) {
  if (contracts.length === 0) return <p className="text-sm text-slate-500">Aucun historique.</p>

  return (
    <ul className="space-y-3">
      {contracts.map((c) => (
        <li key={c.id} className="border-l-2 border-blue-200 pl-3">
          <p className="font-medium">{c.client.name}</p>
          <p className="text-sm text-slate-600">
            {c.startDate.toLocaleDateString('fr-FR')} → {c.endDate.toLocaleDateString('fr-FR')} — {c.amount} MGA
          </p>
        </li>
      ))}
    </ul>
  )
}
