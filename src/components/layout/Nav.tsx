'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const LINKS = [
  { href: '/map', label: 'Carte + BD' },
  { href: '/map/full', label: 'Carte' },
  { href: '/database', label: 'Base de données' },
  { href: '/clients', label: 'Clients' },
  { href: '/dashboard', label: 'Dashboard' },
]

export function Nav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  if (pathname === '/login') return null

  const isAdmin = status === 'authenticated' && session?.user?.role !== 'USER'

  return (
    <nav className="flex h-14 items-center justify-between gap-6 border-b bg-blue-900 px-4 text-white shadow-sm">
      <div className="flex items-center gap-6">
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
          {isAdmin && (
            <Link
              href="/settings/city-prefixes"
              className={`text-sm transition-colors ${
                pathname?.startsWith('/settings') ? 'font-semibold text-white underline underline-offset-4' : 'text-blue-100 hover:text-white'
              }`}
            >
              Réglages
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-sm text-blue-100 transition-colors hover:text-white"
      >
        Déconnexion
      </button>
    </nav>
  )
}
