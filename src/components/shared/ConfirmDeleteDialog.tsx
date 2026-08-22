'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  entityName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  entityName: string
  onConfirm: () => Promise<void>
}) {
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = typed.trim() === entityName

  const confirm = async () => {
    if (!matches) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
      setTyped('')
    } catch {
      setError('Erreur lors de la suppression')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Supprimer {entityLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-sm text-slate-600">
            Cette action est irréversible. Pour confirmer, tapez exactement <strong>{entityName}</strong> ci-dessous.
          </p>
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={confirm}
            disabled={!matches || submitting}
          >
            {submitting ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
