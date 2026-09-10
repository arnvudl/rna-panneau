'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { getPermission } from '@/lib/permissions'

const LINKS = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/map', label: 'Vue Globale (Carte + Table)' },
  { href: '/map/full', label: 'Carte interactive' },
  { href: '/database', label: 'Inventaire' },
  { href: '/clients', label: 'Clients' },
  { href: '/contrats', label: 'Contrats' },
]

export function Nav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  if (pathname === '/login') return null

  const canViewSettings =
    status === 'authenticated' && getPermission(session?.user?.role ?? 'USER', 'view_settings') !== 'forbidden'

  return (
    <nav className="flex h-14 items-center justify-between gap-6 border-b bg-white px-6 shadow-sm">
      <div className="flex h-full items-center gap-8">
        <Link href="/dashboard">
          <img src="/logo.png" alt="RNA" className="h-8 w-auto" />
        </Link>
        <div className="flex h-full items-center gap-6">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== '/map' && pathname?.startsWith(`${l.href}/`))
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex h-full items-center text-sm font-medium transition-colors ${
                  active ? 'text-primary' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Link>
            )
          })}
          {canViewSettings && (
            <Link
              href="/settings/regions"
              className={`relative flex h-full items-center text-sm font-medium transition-colors ${
                pathname?.startsWith('/settings') ? 'text-primary' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Réglages
              {pathname?.startsWith('/settings') && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status === 'authenticated' && <NotificationBell />}
        {status === 'authenticated' && (
          <Link
            href="/account/password"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith('/account') ? 'text-primary' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Mon compte
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  )
}
