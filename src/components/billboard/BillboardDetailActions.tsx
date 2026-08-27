'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { BillboardForm, type EditableBillboard } from '@/components/billboard/BillboardForm'

export function BillboardDetailActions({ billboard }: { billboard: EditableBillboard }) {
  const { status } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (status !== 'authenticated') return null

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Modifier
      </Button>
      <BillboardForm
        mode="edit"
        billboard={billboard}
        open={open}
        onOpenChange={setOpen}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
