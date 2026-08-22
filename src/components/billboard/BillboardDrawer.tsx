'use client'

import Link from 'next/link'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BillboardRow } from '@/components/table/BillboardTable'

export function BillboardDrawer({
  billboard,
  open,
  onOpenChange,
}: {
  billboard: BillboardRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent className="ml-auto h-full w-96 rounded-none">
        <DrawerHeader>
          <DrawerTitle>{billboard?.reference}</DrawerTitle>
        </DrawerHeader>
        {billboard && (
          <div className="space-y-4 p-4">
            <div>
              <p className="text-sm text-slate-600">
                {billboard.city} — {billboard.dimension.replace('D', '').replace('X', 'x')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{billboard.status}</Badge>
                {billboard.damaged && <Badge variant="destructive">Endommagé</Badge>}
              </div>
            </div>
            {billboard.activeClientNames && billboard.activeClientNames.length > 0 && (
              <p className="text-sm">
                Client{billboard.activeClientNames.length > 1 ? 's' : ''} actuel
                {billboard.activeClientNames.length > 1 ? 's' : ''} :{' '}
                <span className="font-medium">{billboard.activeClientNames.join(', ')}</span>
              </p>
            )}
            <Link
              href={`/billboards/${billboard.id}`}
              className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
            >
              Voir en détail
            </Link>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
