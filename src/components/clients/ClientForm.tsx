'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type EditableClient = { id: string; name: string; phone: string | null; email: string | null }

type ClientFormProps =
  | { mode: 'create'; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }
  | { mode: 'edit'; client: EditableClient; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }

export function ClientForm(props: ClientFormProps) {
  const { mode, open, onOpenChange, onSaved } = props
  const initial = mode === 'edit' ? props.client : null

  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/clients' : `/api/clients/${props.client.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          // In edit mode, an emptied field must clear the existing value
          // (send null); in create mode there's nothing to clear, so an
          // omitted key (undefined) is correct there.
          phone: phone.trim() || (mode === 'edit' ? null : undefined),
          email: email.trim() || (mode === 'edit' ? null : undefined),
        }),
      })
      if (res.status === 202 || res.ok) {
        if (mode === 'create') {
          setName('')
          setPhone('')
          setEmail('')
        }
        onOpenChange(false)
        onSaved()
        return
      }
      throw new Error(`Request failed with status ${res.status}`)
    } catch {
      setError(mode === 'create' ? 'Erreur lors de la création du client' : 'Erreur lors de la modification du client')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === 'create' ? 'Nouveau client' : 'Modifier le client'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label>Nom de l&apos;entreprise</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full" disabled={submitting || !name.trim()}>
            {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
