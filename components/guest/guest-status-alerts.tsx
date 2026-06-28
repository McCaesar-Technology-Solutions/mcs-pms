'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, X } from 'lucide-react'
import type { Complaint } from '@/types'
import type { GuestPortalRequest } from '@/lib/data/guest-portal'
import { pickGuestNextAction } from '@/lib/complaints/guest-next-action'

interface GuestStatusAlertsProps {
  complaints: Complaint[]
  requests: GuestPortalRequest[]
  onOpenHelp: () => void
  onOpenStay: () => void
}

function snapshotKey(complaints: Complaint[], requests: GuestPortalRequest[]): string {
  const c = complaints
    .filter((x) => x.status !== 'resolved')
    .map((x) => `${x.id}:${x.status}:${x.scheduled_visit_at ?? ''}:${x.guest_completion_approved_at ?? ''}`)
    .join('|')
  const r = requests.map((x) => `${x.id}:${x.status}`).join('|')
  return `${c}::${r}`
}

export function GuestStatusAlerts({
  complaints,
  requests,
  onOpenHelp,
  onOpenStay,
}: GuestStatusAlertsProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const currentKey = useMemo(() => snapshotKey(complaints, requests), [complaints, requests])
  const [seenKey, setSeenKey] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSeenKey(window.sessionStorage.getItem('guest-portal-status-key'))
  }, [])

  useEffect(() => {
    if (!seenKey || currentKey === seenKey) return
    setDismissedKey(null)
  }, [currentKey, seenKey])

  const changed = Boolean(seenKey && currentKey !== seenKey && dismissedKey !== currentKey)
  const nextAction = pickGuestNextAction(complaints.filter((c) => c.status !== 'resolved'))

  const requestUpdate = requests.find(
    (r) => seenKey && r.status !== 'pending' && !seenKey.includes(`${r.id}:${r.status}`),
  )

  if (!changed && !requestUpdate) return null

  const isRequestUpdate = Boolean(requestUpdate && !nextAction)
  const title = nextAction?.title ?? 'Stay update'
  const detail =
    nextAction?.detail ??
    (requestUpdate
      ? `Your ${requestUpdate.requestType.replace(/_/g, ' ')} request was ${requestUpdate.status}.`
      : 'Something changed on your stay. Tap to view details.')

  function dismiss() {
    setDismissedKey(currentKey)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('guest-portal-status-key', currentKey)
      setSeenKey(currentKey)
    }
  }

  function openTarget() {
    dismiss()
    if (isRequestUpdate) {
      onOpenStay()
    } else {
      onOpenHelp()
    }
  }

  return (
    <div className="guest-notice-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--guest-accent-soft)] text-[var(--brand-purple)]">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide guest-text-subtle">Update</p>
            <p className="mt-0.5 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-relaxed guest-text-muted">{detail}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="guest-icon-btn shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={openTarget}
        className="guest-btn guest-btn-primary mt-3 w-full py-2.5 text-sm"
      >
        {isRequestUpdate ? 'View in My stay' : 'View in Help'}
      </button>
    </div>
  )
}
