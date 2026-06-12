'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Droplets,
  Zap,
  Wind,
  Armchair,
  Sparkles,
  Volume2,
  HelpCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { submitGuestComplaint, getGuestComplaints } from '@/app/actions/guest'
import { GuestPhoneEditor } from '@/components/guest/guest-phone-editor'
import { guestStatusLabel } from '@/components/complaints/complaints-overview'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import { PhoneContactList } from '@/components/ui/phone-contact'
import type { StaffContact } from '@/lib/data/contacts'
import type { Complaint, ComplaintCategory, Guest } from '@/types'

const categories: { id: ComplaintCategory; label: string; icon: typeof Droplets }[] = [
  { id: 'plumbing', label: 'Plumbing', icon: Droplets },
  { id: 'electrical', label: 'Electrical', icon: Zap },
  { id: 'hvac', label: 'HVAC', icon: Wind },
  { id: 'furniture', label: 'Furniture', icon: Armchair },
  { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
  { id: 'noise', label: 'Noise', icon: Volume2 },
  { id: 'other', label: 'Other', icon: HelpCircle },
]

interface GuestPortalProps {
  guest: Guest
  roomNumber: string | null
  propertyContacts: StaffContact[]
}

export function GuestPortal({ guest, roomNumber, propertyContacts }: GuestPortalProps) {
  const [category, setCategory] = useState<ComplaintCategory | null>(null)
  const [description, setDescription] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [disconnected, setDisconnected] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const loadComplaints = useCallback(async () => {
    const result = await getGuestComplaints()
    if (result.success && result.data) setComplaints(result.data)
  }, [])

  useEffect(() => {
    loadComplaints()
    const interval = setInterval(loadComplaints, 15000)
    return () => clearInterval(interval)
  }, [loadComplaints])

  useEffect(() => {
    const supabase = createClient()
    let backoff = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel(`guest-complaints-${guest.id}-${retryKey}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'complaints',
          filter: `guest_id=eq.${guest.id}`,
        },
        () => {
          loadComplaints()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          backoff = 1000
          setDisconnected(false)
        }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setDisconnected(true)
          retryTimer = setTimeout(() => setRetryKey((k) => k + 1), backoff)
          backoff = Math.min(backoff * 2, 8000)
        }
      })

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      supabase.removeChannel(channel)
    }
  }, [guest.id, loadComplaints, retryKey])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) return
    setLoading(true)
    setError(null)
    const result = await submitGuestComplaint({
      category,
      description,
      priority: urgent ? 'urgent' : 'medium',
    })
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setReference(result.data?.reference ?? null)
    setDescription('')
    setCategory(null)
    setUrgent(false)
    await loadComplaints()
  }

  if (reference) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#22124C] px-6 text-center text-white">
        <p className="text-3xl font-semibold text-[#D4A62E]">MOJO APARTMENTS</p>
        <p className="mt-6 text-xl font-medium">Complaint submitted</p>
        <p className="mt-2 text-white/80">Reference: {reference}</p>
        <p className="mt-3 max-w-sm text-sm text-white/70">
          Our team has been notified by SMS/WhatsApp and will respond shortly.
        </p>
        <button
          type="button"
          onClick={() => setReference(null)}
          className="mt-8 rounded-xl bg-[#3C216C] px-6 py-3 font-medium"
        >
          Back to portal
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#22124C] pb-24 text-white">
      {disconnected && (
        <RealtimeReconnectBanner onReconnect={() => setRetryKey((k) => k + 1)} />
      )}
      <header className="px-6 pb-4 pt-8 text-center">
        <p className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#D4A62E]">
          MOJO APARTMENTS
        </p>
        {roomNumber && <p className="mt-2 text-lg">Room {roomNumber}</p>}
        <p className="mt-1 text-white/80">Hi {guest.name}</p>
        <div className="mx-auto mt-4 max-w-md">
          <GuestPhoneEditor initialPhone={guest.phone} />
        </div>
      </header>

      {propertyContacts.length > 0 && (
        <section className="mx-4 mb-6">
          <PhoneContactList
            contacts={propertyContacts}
            title="Contact your manager"
            emptyMessage="Manager contact not available."
            variant="dark"
          />
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 px-4">
        <section>
          <p className="mb-3 text-sm font-medium text-white/90">What needs attention?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors ${
                  category === id
                    ? 'border-[#D4A62E] bg-[#3C216C]'
                    : 'border-white/20 bg-white/5'
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label htmlFor="description" className="mb-2 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            rows={5}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40"
            placeholder="Tell us what's wrong…"
          />
        </section>

        <section className="flex gap-3">
          {(['Normal', 'Urgent'] as const).map((label) => {
            const isUrgent = label === 'Urgent'
            const active = urgent === isUrgent
            return (
              <button
                key={label}
                type="button"
                onClick={() => setUrgent(isUrgent)}
                className={`flex-1 rounded-xl py-4 text-lg font-semibold ${
                  active ? 'bg-[#D85A30] text-white' : 'bg-white/10 text-white/80'
                }`}
              >
                {label}
              </button>
            )
          })}
        </section>

        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#22124C]/95 p-4 backdrop-blur">
          <button
            type="submit"
            disabled={loading || !category || description.length < 10}
            className="w-full rounded-xl bg-[#3C216C] py-4 text-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit complaint'}
          </button>
        </div>
      </form>

      {complaints.length > 0 && (
        <section className="mt-10 px-4">
          <h2 className="mb-3 text-lg font-semibold">My complaints</h2>
          <ul className="space-y-2">
            {complaints.map((c) => (
              <li key={c.id} className="rounded-xl bg-white/10 px-4 py-3">
                <p className="capitalize">{c.category}</p>
                <p className="text-sm text-[#D4A62E]">{guestStatusLabel(c.status, c.approval_stage)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
