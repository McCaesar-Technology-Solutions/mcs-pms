'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarClock } from 'lucide-react'
import { updateReservationLifecycleSettings } from '@/app/actions/settings'
import type { HotelSettings } from '@/lib/data/settings'
import type { CheckInPaymentMode, NoShowChargePolicy } from '@/types'
import { FormField } from '@/components/ui/form-field'
import { formatCheckInPaymentPolicyLabel } from '@/lib/billing/check-in-payment-policy'

interface ReservationLifecycleSettingsPanelProps {
  hotelSettings: HotelSettings
}

const NO_SHOW_POLICIES: { value: NoShowChargePolicy; label: string; hint: string }[] = [
  { value: 'none', label: 'No charge', hint: 'Mark no-show without posting a fee' },
  { value: 'one_night', label: 'One night', hint: 'Charge the first night of the stay' },
  { value: 'full_stay', label: 'Full stay', hint: 'Charge the entire booked stay' },
]

const CHECK_IN_PAYMENT_MODES: {
  value: CheckInPaymentMode
  label: string
  hint: string
  showValue: boolean
  valueLabel: string
  valueHint: string
}[] = [
  {
    value: 'none',
    label: 'Optional',
    hint: 'Staff may check in without collecting payment',
    showValue: false,
    valueLabel: '',
    valueHint: '',
  },
  {
    value: 'percent',
    label: 'Percent of total',
    hint: 'Common default — e.g. 50% before the guest enters',
    showValue: true,
    valueLabel: 'Minimum percent',
    valueHint: '0–100',
  },
  {
    value: 'fixed',
    label: 'Fixed amount',
    hint: 'Same GHS minimum for every stay',
    showValue: true,
    valueLabel: 'Minimum amount (GHS)',
    valueHint: 'e.g. 200',
  },
  {
    value: 'first_night',
    label: 'First night',
    hint: 'Uses the booked nightly rate (after discounts on the invoice)',
    showValue: false,
    valueLabel: '',
    valueHint: '',
  },
]

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
  const [timezone, setTimezone] = useState('Africa/Accra')
  const [checkInPaymentMode, setCheckInPaymentMode] = useState<CheckInPaymentMode>('percent')
  const [checkInPaymentValue, setCheckInPaymentValue] = useState('50')

  useEffect(() => {
    setHoldOnline(String(hotelSettings.holdDurationOnlineMinutes))
    setHoldPhone(String(hotelSettings.holdDurationPhoneMinutes))
    setHoldAgent(String(hotelSettings.holdDurationAgentMinutes))
    setNoShowTime(hotelSettings.noShowTime)
    setArchiveDays(String(hotelSettings.postStayArchiveDelayDays))
    setNoShowPolicy(hotelSettings.noShowChargePolicy)
    setHoldRoomAfterNoShow(hotelSettings.noShowHoldRoom)
    setLifecycleV2(hotelSettings.useLifecycleV2)
    setTimezone(hotelSettings.timezone)
    setCheckInPaymentMode(hotelSettings.checkInPaymentMode)
    setCheckInPaymentValue(String(hotelSettings.checkInPaymentValue))
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
        timezone: timezone.trim(),
        checkInPaymentMode,
        checkInPaymentValue: Number(checkInPaymentValue),
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
    })
  }

  return (
    <div className="surface-card mt-6 overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Reservation lifecycle</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hold timers, no-show rules, and automated jobs for {hotelSettings.name}.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="surface-card-body space-y-8">
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Automation</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Staff workflows always use the lifecycle state machine. Cron jobs run only when enabled.
            </p>
          </div>
          <label className="surface-inset flex cursor-pointer items-start gap-3 rounded-xl p-4 transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              checked={lifecycleV2}
              onChange={(e) => setLifecycleV2(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                Enable lifecycle v2 cron jobs
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Hold expiry, pre-arrival reminders, no-show detection, overstay alerts, auto-checkout
                prompts, and post-stay archive.
              </span>
            </span>
          </label>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Hold durations</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How long unpaid reservations stay on hold before expiring.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Online booking" hint="Minutes">
              <input
                type="number"
                min={5}
                value={holdOnline}
                onChange={(e) => setHoldOnline(e.target.value)}
                className="input-soft"
              />
            </FormField>
            <FormField label="Phone booking" hint="Minutes">
              <input
                type="number"
                min={15}
                value={holdPhone}
                onChange={(e) => setHoldPhone(e.target.value)}
                className="input-soft"
              />
            </FormField>
            <FormField label="Agent / walk-in" hint="Minutes">
              <input
                type="number"
                min={60}
                value={holdAgent}
                onChange={(e) => setHoldAgent(e.target.value)}
                className="input-soft"
              />
            </FormField>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">No-show & archive</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cutoff time and billing when guests do not arrive.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="No-show cutoff time" hint="e.g. 23:59 or 11:00 PM">
              <input
                type="text"
                value={noShowTime}
                onChange={(e) => setNoShowTime(e.target.value)}
                placeholder="23:59"
                className="input-soft"
              />
            </FormField>
            <FormField label="Archive delay" hint="Days after checkout before archiving">
              <input
                type="number"
                min={1}
                value={archiveDays}
                onChange={(e) => setArchiveDays(e.target.value)}
                className="input-soft"
              />
            </FormField>
            <FormField
              label="Property timezone"
              hint="IANA timezone for no-show and checkout crons (e.g. Africa/Accra)"
            >
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input-soft"
                placeholder="Africa/Accra"
              />
            </FormField>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">No-show charge policy</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {NO_SHOW_POLICIES.map((policy) => (
                <button
                  key={policy.value}
                  type="button"
                  onClick={() => setNoShowPolicy(policy.value)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    noShowPolicy === policy.value
                      ? 'border-primary bg-primary/5 font-semibold text-foreground'
                      : 'border-[#E9ECEF] text-muted-foreground hover:bg-[#FAFDFF]'
                  }`}
                >
                  {policy.label}
                  <span className="mt-0.5 block text-xs font-normal">{policy.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="surface-inset flex cursor-pointer items-center gap-3 rounded-xl p-4">
            <input
              type="checkbox"
              checked={holdRoomAfterNoShow}
              onChange={(e) => setHoldRoomAfterNoShow(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              Keep the room blocked after a no-show{' '}
              <span className="text-muted-foreground">(do not release for resale same night)</span>
            </span>
          </label>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Check-in payment minimum</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How much must be collected before a guest enters. Managers and owners can waive the
              minimum for prepaid channels or approved exceptions.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECK_IN_PAYMENT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setCheckInPaymentMode(mode.value)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  checkInPaymentMode === mode.value
                    ? 'border-primary bg-primary/5 font-semibold text-foreground'
                    : 'border-[#E9ECEF] text-muted-foreground hover:bg-[#FAFDFF]'
                }`}
              >
                {mode.label}
                <span className="mt-0.5 block text-xs font-normal">{mode.hint}</span>
              </button>
            ))}
          </div>
          {CHECK_IN_PAYMENT_MODES.find((m) => m.value === checkInPaymentMode)?.showValue && (
            <FormField
              label={
                CHECK_IN_PAYMENT_MODES.find((m) => m.value === checkInPaymentMode)?.valueLabel ??
                'Value'
              }
              hint={
                CHECK_IN_PAYMENT_MODES.find((m) => m.value === checkInPaymentMode)?.valueHint
              }
            >
              <input
                type="number"
                min={0}
                max={checkInPaymentMode === 'percent' ? 100 : undefined}
                step={checkInPaymentMode === 'percent' ? 1 : 0.01}
                value={checkInPaymentValue}
                onChange={(e) => setCheckInPaymentValue(e.target.value)}
                className="input-soft"
              />
            </FormField>
          )}
          <p className="text-xs text-muted-foreground">
            Preview:{' '}
            {formatCheckInPaymentPolicyLabel({
              mode: checkInPaymentMode,
              value: Number(checkInPaymentValue) || 0,
            })}
          </p>
        </section>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {saved && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Reservation settings saved.
          </p>
        )}

        <div className="surface-card-footer !px-0 !pb-0 !pt-2">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pending ? 'Saving…' : 'Save reservation settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
