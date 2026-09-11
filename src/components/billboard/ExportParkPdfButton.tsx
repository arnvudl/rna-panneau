'use client'

import { useState } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Filters } from '@/components/table/FilterBar'

function buildQuery(params: Record<string, string>, filters: Filters) {
  const search = new URLSearchParams(params)
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) search.set(k, v)
  }
  return search.toString()
}

function downloadFile(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function ExportParkPdfButton({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <FileText className="mr-1 h-4 w-4" />
        Exporter
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-md bg-popover py-1 ring-1 ring-foreground/10 shadow-lg">
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                window.open(`/api/billboards/pdf?${buildQuery({ mode: 'summary' }, filters)}`, '_blank')
                setOpen(false)
              }}
            >
              PDF — Récapitulatif (tableau)
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                window.open(`/api/billboards/pdf?${buildQuery({ mode: 'full' }, filters)}`, '_blank')
                setOpen(false)
              }}
            >
              PDF — Complet (1 page/panneau)
            </button>
            <div className="my-1 border-t" />
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                downloadFile(`/api/billboards/xlsx?${buildQuery({}, filters)}`)
                setOpen(false)
              }}
            >
              Excel (.xlsx)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
