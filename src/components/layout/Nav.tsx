'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/map', label: 'Carte + BD' },
  { href: '/database', label: 'Base de données' },
  { href: '/clients', label: 'Clients' },
  { href: '/dashboard', label: 'Dashboard' },
]

export function Nav() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <nav className="flex h-14 items-center gap-6 border-b bg-blue-900 px-4 text-white shadow-sm">
      <span className="font-semibold tracking-tight">RNA</span>
      <div className="flex items-center gap-4">
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname?.startsWith(`${l.href}/`)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                active ? 'font-semibold text-white underline underline-offset-4' : 'text-blue-100 hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
