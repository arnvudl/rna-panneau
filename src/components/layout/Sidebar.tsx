'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  ChevronLeft,
  FileText,
  LayoutDashboard,
  Map,
  Package,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { getPermission } from '@/lib/permissions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'rna-sidebar-collapsed'

const MAIN_LINKS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/map/full', label: 'Carte interactive', icon: Map },
  { href: '/database', label: 'Inventaire', icon: Package },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/contrats', label: 'Contrats', icon: FileText },
]

function isActive(pathname: string | null, href: string) {
  return pathname === href || (href !== '/map' && pathname?.startsWith(`${href}/`))
}

function readStoredCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === null) return true
    return stored === 'true'
  } catch {
    return true
  }
}

function writeStoredCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {}
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  active: boolean
  collapsed: boolean
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex h-10 items-center gap-3 rounded-r-md border-l-4 px-3 text-sm font-medium transition-colors',
        active
          ? 'border-l-primary bg-primary/5 text-primary'
          : 'border-l-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    setCollapsed(readStoredCollapsed())
  }, [])

  if (pathname === '/login') return null

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      writeStoredCollapsed(next)
      return next
    })
  }

  const canViewSettings =
    status === 'authenticated' && getPermission(session?.user?.role ?? 'USER', 'view_settings') !== 'forbidden'

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex h-screen shrink-0 flex-col border-r bg-white shadow-sm transition-all duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
          <Link href="/dashboard" className="flex min-w-0 items-center">
            <img src="/logo.png" alt="RNA" className="h-8 w-8 shrink-0 object-contain" />
          </Link>
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-3 px-2">
          {MAIN_LINKS.map((l) => (
            <NavItem
              key={l.href}
              href={l.href}
              label={l.label}
              icon={l.icon}
              active={!!isActive(pathname, l.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t px-2 py-3">
          <div className="flex flex-col gap-1">
            {status === 'authenticated' && (
              <div
                className={cn(
                  'flex h-10 items-center gap-3 rounded-r-md border-l-4 border-l-transparent px-3 text-sm font-medium text-slate-500'
                )}
              >
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="flex h-5 w-5 items-center justify-center">
                          <NotificationBell />
                        </div>
                      }
                    />
                    <TooltipContent side="right">Notifications</TooltipContent>
                  </Tooltip>
                ) : (
                  <>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <NotificationBell />
                    </div>
                    <span className="truncate">Notifications</span>
                  </>
                )}
              </div>
            )}

            {canViewSettings && (
              <NavItem
                href="/settings/regions"
                label="Réglages"
                icon={Settings}
                active={!!pathname?.startsWith('/settings')}
                collapsed={collapsed}
              />
            )}

            {status === 'authenticated' && (
              <DropdownMenu>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DropdownMenuTrigger className="flex h-10 w-full items-center gap-3 rounded-r-md border-l-4 border-l-transparent px-3 text-sm font-medium text-slate-500 transition-colors outline-none hover:bg-slate-100 hover:text-slate-900">
                          <User className="h-5 w-5 shrink-0" />
                        </DropdownMenuTrigger>
                      }
                    />
                    <TooltipContent side="right">Mon Compte</TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenuTrigger className="flex h-10 w-full items-center gap-3 rounded-r-md border-l-4 border-l-transparent px-3 text-sm font-medium text-slate-500 transition-colors outline-none hover:bg-slate-100 hover:text-slate-900">
                    <User className="h-5 w-5 shrink-0" />
                    <span className="truncate">Mon Compte</span>
                  </DropdownMenuTrigger>
                )}
                <DropdownMenuContent side="right" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {session?.user?.email ?? 'Compte'}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {session?.user?.role ?? ''}
                      </span>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href="/account/password">Mon compte</Link>} />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
