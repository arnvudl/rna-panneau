'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { ClientForm, type EditableClient } from '@/components/clients/ClientForm'

export function ClientDetailActions({ client }: { client: EditableClient }) {
  const { status } = useSession()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  if (status !== 'authenticated') return null

  const deleteClient = async () => {
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`)
    }
    router.push('/clients')
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        Modifier
      </Button>
      <ClientForm
        mode="edit"
        client={client}
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
        entityLabel="ce client"
        entityName={client.name}
        onConfirm={deleteClient}
      />
    </div>
  )
}
