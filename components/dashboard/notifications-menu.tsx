'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Bell,
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  LogIn,
  MessageCircle,
  MessageSquare,
  Sparkles,
  UserPlus,
  Wrench,
} from 'lucide-react'
import { loadNotifications } from '@/app/actions/notifications'
import { HeaderDropdownPanel } from '@/components/dashboard/header-dropdown-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import type { AppNotification } from '@/lib/data/notifications'
import type { Profile } from '@/types'

interface NotificationsMenuProps {
  profile?: Profile | null
}

const KIND_ICONS: Record<AppNotification['kind'], typeof FileText> = {
  overdue_invoice: FileText,
  pending_invoice: FileText,
  checkin_today: LogIn,
  checkout_today: Clock,
  pending_complaint: Wrench,
  complaint_approval: Bell,
  unassigned_complaint: UserPlus,
  guest_request: Bell,
  guest_stay_chat: MessageCircle,
  guest_message: MessageSquare,
  housekeeping_inspect: Sparkles,
  housekeeping_overdue: Briefcase,
}

export function NotificationsMenu({ profile }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [pending, startTransition] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)

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
  useRealtimeRefresh('complaints', fetchNotifications)
  useRealtimeRefresh('housekeeping', fetchNotifications)
  useRealtimeRefresh('messages', fetchNotifications)
  useRealtimeRefresh('guest_portal', fetchNotifications)

  useEffect(() => {
    if (!open) return
    fetchNotifications()
  }, [open, fetchNotifications])

  const totalCount = items.length
  const urgentCount = items.filter((i) => i.urgent).length

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={totalCount > 0 ? `Notifications, ${totalCount} items` : 'Notifications'}
        className="topbar-icon-btn relative"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-bold tabular-nums text-white ${
              urgentCount > 0 ? 'bg-[var(--brand-orange)]' : 'bg-primary'
            }`}
          >
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      <HeaderDropdownPanel
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        width={340}
        className="modal-panel surface-card overflow-y-auto overscroll-contain rounded-xl border border-[rgba(var(--glow-purple),0.1)] bg-white py-1 shadow-elevation-3"
      >
        <div className="surface-card-header px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {totalCount === 0
              ? 'Operational alerts for your property'
              : `${totalCount} item${totalCount === 1 ? '' : 's'}${urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}`}
          </p>
        </div>
        {pending && items.length === 0 ? (
          <div className="space-y-2 px-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 py-1">
                <Skeleton className="h-4 w-4 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-4/5 max-w-[12rem]" />
                  <Skeleton className="h-3 w-full max-w-[16rem]" />
                </div>
              </div>
            ))}
          </div>
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
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      item.urgent ? 'text-[var(--brand-gold-dark)]' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                  </span>
                </Link>
              )
            })}
            {(profile?.role === 'owner' || profile?.role === 'manager') && (
              <div className="border-t border-[#E9ECEF] px-4 py-2">
                <Link
                  href={
                    profile.role === 'owner'
                      ? '/owner/settings#sms-log'
                      : '/manager/dashboard#sms-log'
                  }
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
      </HeaderDropdownPanel>
    </div>
  )
}

export function settingsHref(role?: Profile['role']): string | null {
  if (role === 'owner') return '/owner/settings'
  if (role === 'manager') return '/manager/staff'
  return null
}

export function settingsMenuLabel(role?: Profile['role']): string {
  if (role === 'owner') return 'Settings'
  if (role === 'manager') return 'Account & team'
  return 'Settings'
}
