'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormError } from '@/components/shared/FormError'

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  entityName,
  confirmLabel = 'Nom',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  entityName: string
  confirmLabel?: string
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Supprimer {entityLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormError>{error}</FormError>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. Pour confirmer, tapez exactement <strong>{entityName}</strong> ci-dessous.
          </p>
          <div className="space-y-1">
            <Label>{confirmLabel}</Label>
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
