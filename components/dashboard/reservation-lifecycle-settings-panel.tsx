'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarClock } from 'lucide-react'
import { updateReservationLifecycleSettings } from '@/app/actions/settings'
import type { HotelSettings } from '@/lib/data/settings'
import type { NoShowChargePolicy } from '@/types'

interface ReservationLifecycleSettingsPanelProps {
  hotelSettings: HotelSettings
}

export function ReservationLifecycleSettingsPanel({
  hotelSettings,
}: ReservationLifecycleSettingsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [holdOnline, setHoldOnline] = useState('15')
  const [holdPhone, setHoldPhone] = useState('240')
  const [holdAgent, setHoldAgent] = useState('1440')
  const [noShowTime, setNoShowTime] = useState('23:59')
  const [archiveDays, setArchiveDays] = useState('30')
  const [noShowPolicy, setNoShowPolicy] = useState<NoShowChargePolicy>('one_night')
  const [holdRoomAfterNoShow, setHoldRoomAfterNoShow] = useState(false)
  const [lifecycleV2, setLifecycleV2] = useState(false)

  useEffect(() => {
    setHoldOnline(String(hotelSettings.holdDurationOnlineMinutes))
    setHoldPhone(String(hotelSettings.holdDurationPhoneMinutes))
    setHoldAgent(String(hotelSettings.holdDurationAgentMinutes))
    setNoShowTime(hotelSettings.noShowTime)
    setArchiveDays(String(hotelSettings.postStayArchiveDelayDays))
    setNoShowPolicy(hotelSettings.noShowChargePolicy)
    setHoldRoomAfterNoShow(hotelSettings.noShowHoldRoom)
    setLifecycleV2(hotelSettings.useLifecycleV2)
    setError(null)
    setSaved(false)
  }, [hotelSettings])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateReservationLifecycleSettings({
        hotelId: hotelSettings.id,
        holdDurationOnlineMinutes: Number(holdOnline),
        holdDurationPhoneMinutes: Number(holdPhone),
        holdDurationAgentMinutes: Number(holdAgent),
        noShowTime: noShowTime.trim(),
        postStayArchiveDelayDays: Number(archiveDays),
        noShowChargePolicy: noShowPolicy,
        noShowHoldRoom: holdRoomAfterNoShow,
        useLifecycleV2: lifecycleV2,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-elevation-1">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[var(--comp-sky-soft)] p-2 text-[var(--comp-sky-ink)]">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reservation lifecycle</h2>
          <p className="text-sm text-muted-foreground">
            Hold timers, no-show rules, and automated cron jobs for this property.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={lifecycleV2}
            onChange={(e) => setLifecycleV2(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span>
            Enable lifecycle v2 cron jobs{' '}
            <span className="text-muted-foreground">(hold expiry, pre-arrival, no-show, overstay)</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Online hold (minutes)">
            <input
              type="number"
              min={5}
              value={holdOnline}
              onChange={(e) => setHoldOnline(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Phone hold (minutes)">
            <input
              type="number"
              min={15}
              value={holdPhone}
              onChange={(e) => setHoldPhone(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Agent hold (minutes)">
            <input
              type="number"
              min={60}
              value={holdAgent}
              onChange={(e) => setHoldAgent(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No-show cutoff time">
            <input
              type="text"
              value={noShowTime}
              onChange={(e) => setNoShowTime(e.target.value)}
              placeholder="23:59 or 11:00 PM"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Archive delay (days after checkout)">
            <input
              type="number"
              min={1}
              value={archiveDays}
              onChange={(e) => setArchiveDays(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No-show charge policy">
            <select
              value={noShowPolicy}
              onChange={(e) => setNoShowPolicy(e.target.value as NoShowChargePolicy)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            >
              <option value="none">None</option>
              <option value="one_night">One night</option>
              <option value="full_stay">Full stay</option>
            </select>
          </Field>
          <label className="flex items-end gap-3 pb-2 text-sm">
            <input
              type="checkbox"
              checked={holdRoomAfterNoShow}
              onChange={(e) => setHoldRoomAfterNoShow(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Hold room after no-show
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Reservation settings saved.</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save reservation settings'}
        </button>
      </form>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
