'use client'

import { ContratKanban } from '@/components/contrats/ContratKanban'

export default function ContratsPage() {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-slate-50">
      <div className="flex items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contrats</h1>
      </div>
      <ContratKanban />
    </div>
  )
}
