'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageOff, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Photo = { id: string; filename: string; createdAt: string }

export function PhotoGallery({
  billboardId,
  photos,
}: {
  billboardId: string
  photos: Photo[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/billboards/${billboardId}/photos`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (photoId: string) => {
    setDeletingId(photoId)
    setError(null)
    try {
      const res = await fetch(`/api/billboards/${billboardId}/photos/${photoId}`, {
        method: 'DELETE',
      })
      if (res.status === 202) {
        setError('Demande de suppression envoyée pour approbation')
      } else if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  if (photos.length === 0 && !uploading) {
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-slate-50 text-slate-400">
          <ImageOff className="h-10 w-10" />
          <p className="text-sm font-medium">Aucune photo</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Plus className="mr-1 h-4 w-4" /> Ajouter une photo
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/uploads/${p.filename}`}
              alt=""
              className="aspect-video w-full rounded-lg border object-cover"
            />
            <button
              onClick={() => remove(p.id)}
              disabled={deletingId === p.id}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <Plus className="mr-1 h-4 w-4" /> {uploading ? 'Upload…' : 'Ajouter une photo'}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
    </div>
  )
}
