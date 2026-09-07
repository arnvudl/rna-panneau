'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { BillboardForm, type EditableBillboard } from '@/components/billboard/BillboardForm'

export function BillboardDetailActions({ billboard }: { billboard: EditableBillboard }) {
  const { status } = useSession()
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (status !== 'authenticated') return null

  const deleteBillboard = async () => {
    const res = await fetch(`/api/billboards/${billboard.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`)
    }
    if (res.status === 202) {
      toast.info("Demande d'approbation envoyée", {
        description: 'Un administrateur doit valider la suppression du panneau.',
      })
      router.refresh()
    } else {
      toast.success('Panneau supprimé')
      router.push('/database')
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        Modifier
      </Button>
      <BillboardForm
        mode="edit"
        billboard={billboard}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => router.refresh()}
      />
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        Supprimer
      </Button>
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityLabel="ce panneau"
        entityName={billboard.reference}
        onConfirm={deleteBillboard}
      />
    </div>
  )
}
