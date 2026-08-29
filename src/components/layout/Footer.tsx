'use client'

import { usePathname } from 'next/navigation'

export function Footer() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <footer className="border-t bg-white px-6 py-3">
      <div className="flex items-center justify-center">
        <p className="text-xs text-slate-400">
          Concu et développé par <span className="font-medium text-slate-500">Arnaud Leroy</span>
        </p>
      </div>
    </footer>
  )
}
