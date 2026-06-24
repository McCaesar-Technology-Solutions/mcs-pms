'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Complaint } from '@/types'
import type { GuestPortalRequest } from '@/lib/data/guest-portal'
import { pickGuestNextAction } from '@/lib/complaints/guest-next-action'

interface GuestStatusAlertsProps {
  complaints: Complaint[]
  requests: GuestPortalRequest[]
  onOpenHelp: () => void
}

function snapshotKey(complaints: Complaint[], requests: GuestPortalRequest[]): string {
  const c = complaints
    .filter((x) => x.status !== 'resolved')
    .map((x) => `${x.id}:${x.status}:${x.scheduled_visit_at ?? ''}:${x.guest_completion_approved_at ?? ''}`)
    .join('|')
  const r = requests.map((x) => `${x.id}:${x.status}`).join('|')
  return `${c}::${r}`
}

export function GuestStatusAlerts({ complaints, requests, onOpenHelp }: GuestStatusAlertsProps) {
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

  return (
    <div className="mx-4 mb-2 rounded-2xl border border-[#D4A62E]/40 bg-[#D4A62E]/15 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4A62E]">Update</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-white/75">{detail}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          dismiss()
          onOpenHelp()
        }}
        className="mt-3 w-full rounded-xl bg-[#3C216C] py-2.5 text-sm font-semibold text-white"
      >
        View in Help
      </button>
    </div>
  )
}
