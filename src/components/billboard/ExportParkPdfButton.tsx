'use client'

import { FileText, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

/**
 * Export menu for the inventory.
 *
 * This was a hand-rolled dropdown: local `open` state, a full-screen invisible
 * div as the outside-click catcher, an absolutely-positioned panel with its own
 * `rounded-md bg-popover shadow-lg`, and raw `<button>` rows with their own
 * hover style — a second, worse implementation of ui/dropdown-menu, which the
 * sidebar's account menu already uses. It now uses the primitive, which brings
 * keyboard navigation, focus return, escape-to-close and portal positioning
 * that the hand-rolled version never had.
 */
export function ExportParkPdfButton({ filters }: { filters: Filters }) {
  return (
    <DropdownMenu>
      {/* Button-wraps-Trigger rather than Trigger-wraps-Button: `Button` is a
          Base UI Button, and passing it into the trigger's `render` drops the
          menu's own trigger props, leaving a button that opens nothing. */}
      <Button variant="outline" size="sm" render={<DropdownMenuTrigger />}>
        <FileText className="mr-1 h-4 w-4" />
        Exporter
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => window.open(`/api/billboards/pdf?${buildQuery({ mode: 'summary' }, filters)}`, '_blank')}
        >
          PDF — Récapitulatif (tableau)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(`/api/billboards/pdf?${buildQuery({ mode: 'full' }, filters)}`, '_blank')}
        >
          PDF — Complet (1 page/panneau)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => downloadFile(`/api/billboards/xlsx?${buildQuery({}, filters)}`)}>
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
