'use client'

import { useState } from 'react'
import { ContratKanban } from '@/components/contrats/ContratKanban'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/shared/PageShell'
import { PageHeader } from '@/components/shared/PageHeader'

export default function ContratsPage() {
  // The "+ Nouveau contrat" button used to live inside ContratKanban, on a row
  // of its own below the page title — so the Contrats page was the only page
  // whose primary action was not in its header. The button is hoisted here and
  // the open state is passed down, since the create dialog's onCreated has to
  // refetch the board and that belongs with the board.
  const [createOpen, setCreateOpen] = useState(false)

  return (
    // Full-bleed: a 5-column Kanban must stretch across the monitor rather than
    // sit in a centered column (DESIGN.md, The No Dead Space Rule).
    <PageShell fullBleed fill>
      <PageHeader
        breadcrumbs={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Contrats' }]}
        title="Contrats"
        actions={<Button onClick={() => setCreateOpen(true)}>+ Nouveau contrat</Button>}
      />
      <ContratKanban createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
    </PageShell>
  )
}
