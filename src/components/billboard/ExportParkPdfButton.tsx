'use client'

import { useState } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Filters } from '@/components/table/FilterBar'

function buildQuery(mode: string, filters: Filters) {
  const params = new URLSearchParams({ mode })
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, v)
  }
  return params.toString()
}

export function ExportParkPdfButton({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <FileText className="mr-1 h-4 w-4" />
        Export PDF
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border bg-white py-1 shadow-lg">
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
              onClick={() => {
                window.open(`/api/billboards/pdf?${buildQuery('summary', filters)}`, '_blank')
                setOpen(false)
              }}
            >
              Récapitulatif (tableau)
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
              onClick={() => {
                window.open(`/api/billboards/pdf?${buildQuery('full', filters)}`, '_blank')
                setOpen(false)
              }}
            >
              Complet (1 page/panneau)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
