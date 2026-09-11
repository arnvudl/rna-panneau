'use client'

import { ContratKanban } from '@/components/contrats/ContratKanban'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export default function ContratsPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Contrats' }]} />
      <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-foreground">Contrats</h1>
      </div>
      <ContratKanban />
    </div>
  )
}
