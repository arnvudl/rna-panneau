'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'

export function ClientDetailActions({ client }: { client: { id: string; name: string } }) {
  const { status } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Any authenticated role may trigger deletion — the API itself routes USER
  // requests to the approval queue instead of deleting directly.
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
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Supprimer
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        entityLabel="ce client"
        entityName={client.name}
        onConfirm={deleteClient}
      />
    </>
  )
}
