'use client'

import { ContratKanban } from '@/components/contrats/ContratKanban'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export default function ContratsPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Contrats' }]} />
      <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contrats</h1>
      </div>
      <ContratKanban />
    </div>
  )
}
