'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PhotoGallery } from '@/components/billboard/PhotoGallery'

type Photo = { id: string; filename: string; createdAt: string }

export function ContractPhotoLink({ billboardId, billboardReference }: { billboardId: string; billboardReference: string }) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch(`/api/billboards/${billboardId}`)
      if (res.ok) {
        const data = await res.json()
        setPhotos(Array.isArray(data.photos) ? data.photos : [])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-sm font-medium text-primary hover:underline"
      >
        Voir photo
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Photos — {billboardReference}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <PhotoGallery billboardId={billboardId} photos={photos} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
