'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getPermission } from '@/lib/permissions'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  linkUrl: string | null
  read: boolean
  createdAt: string
}

/**
 * Bell trigger + flyout panel. Rendered inline inside the sidebar rail. The
 * flyout uses the Popover primitive (Base UI, same library as the
 * DropdownMenu in Sidebar.tsx) so it portals out of the rail and repositions
 * itself to stay within the viewport, instead of a hand-rolled `absolute`
 * div that could grow past the bottom of the screen.
 */
export function NotificationBell() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const canManageNotifications =
    sessionStatus === 'authenticated' &&
    getPermission(session?.user?.role ?? 'USER', 'manage_notifications') !== 'forbidden'
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }, [])

  useEffect(() => {
    // Wait for the session so the admin-only expiration check (403 for USER)
    // is only fired for admins.
    if (sessionStatus !== 'authenticated') return
    if (canManageNotifications) {
      fetch('/api/notifications/check-expirations', { method: 'POST' })
        .catch(() => {})
        .finally(fetchNotifications)
    } else {
      fetchNotifications()
    }
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications, canManageNotifications, sessionStatus])

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    if (n.linkUrl) {
      router.push(n.linkUrl)
      setOpen(false)
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'À l\'instant'
    if (mins < 60) return `Il y a ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Il y a ${hours}h`
    const days = Math.floor(hours / 24)
    return `Il y a ${days}j`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex h-5 w-5 items-center justify-center text-slate-500 transition-colors hover:text-slate-900"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent side="right" align="start" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Aucune notification
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${
                  !n.read ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{n.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
