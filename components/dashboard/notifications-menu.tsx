'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle, Clock, FileText, LogIn, MessageSquare } from 'lucide-react'
import { loadNotifications } from '@/app/actions/notifications'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import type { AppNotification } from '@/lib/data/notifications'
import type { Profile } from '@/types'

interface NotificationsMenuProps {
  profile?: Profile | null
}

const KIND_ICONS: Record<AppNotification['kind'], typeof FileText> = {
  overdue_invoice: FileText,
  checkin_today: LogIn,
  checkout_today: Clock,
  pending_complaint: Bell,
}

export function NotificationsMenu({ profile }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [pending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(() => {
    if (!profile?.hotel_id) return
    startTransition(async () => {
      const data = await loadNotifications()
      setItems(data)
    })
  }, [profile?.hotel_id])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useRealtimeRefresh('layout', fetchNotifications)

  useEffect(() => {
    if (!open) return
    fetchNotifications()
  }, [open, fetchNotifications])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const urgentCount = items.filter((i) => i.urgent).length

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Notifications"
        className="main-header-icon relative rounded-xl p-2.5 transition-colors hover:bg-white/50"
      >
        <Bell className="h-5 w-5" />
        {urgentCount > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-destructive" />
        )}
      </button>

      {open && (
        <div className="modal-panel surface-card absolute right-0 z-50 mt-2 w-80 max-h-96 overflow-y-auto py-1 shadow-elevation-3">
          <div className="surface-card-header px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">Operational alerts for your property</p>
          </div>
          {pending && items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">All clear — nothing needs attention.</p>
            </div>
          ) : (
            <>
              {items.map((item) => {
                const Icon = KIND_ICONS[item.kind]
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                    </span>
                  </Link>
                )
              })}
              {profile?.role === 'owner' && (
                <div className="border-t border-[#E9ECEF] px-4 py-2">
                  <Link
                    href="/owner/settings#sms-log"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 py-2 text-xs font-semibold text-primary hover:underline"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    View SMS delivery log
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function settingsHref(role?: Profile['role']): string {
  if (role === 'owner') return '/owner/settings'
  if (role === 'manager') return '/manager/staff'
  return '/login'
}
