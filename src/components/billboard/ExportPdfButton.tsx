'use client'

import { Button } from '@/components/ui/button'

export function ExportPdfButton({ billboardId }: { billboardId: string }) {
  return (
    <Button variant="outline" onClick={() => window.open(`/api/billboards/${billboardId}/pdf`, '_blank')}>
      Exporter en PDF
    </Button>
  )
}
