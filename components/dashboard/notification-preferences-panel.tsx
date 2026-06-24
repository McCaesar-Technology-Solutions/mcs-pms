'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, MessageSquare } from 'lucide-react'
import { updateNotificationPreferences } from '@/app/actions/settings'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import {
  NOTIFICATION_PREF_GROUPS,
  NOTIFICATION_PREF_LABELS,
  NOTIFICATION_ALWAYS_SEND,
  mergeNotificationPrefs,
  type NotificationSmsPrefs,
  type NotificationTemplateKey,
} from '@/lib/notifications/preferences'

interface NotificationPreferencesPanelProps {
  hotelId: string
  initialPrefs?: NotificationSmsPrefs | null
}

export function NotificationPreferencesPanel({
  hotelId,
  initialPrefs,
}: NotificationPreferencesPanelProps) {
  const [prefs, setPrefs] = useState(() => mergeNotificationPrefs(initialPrefs))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPrefs(mergeNotificationPrefs(initialPrefs))
    setError(null)
    setSaved(false)
  }, [hotelId, initialPrefs])

  function toggle(key: NotificationTemplateKey) {
    if (NOTIFICATION_ALWAYS_SEND.has(key)) return
    setPrefs((current) => ({ ...current, [key]: !current[key] }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateNotificationPreferences({ hotelId, prefs })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">SMS notifications</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Toggles are saved per property and enforced before every SMS. Staff invites and
              security codes (2FA) always send. Disabled alerts appear as{' '}
              <span className="font-semibold text-foreground">skipped</span> in the message log
              below.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {NOTIFICATION_PREF_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-3">
              <p className="font-semibold text-foreground">{group.title}</p>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>
            <ul className="divide-y divide-[#E9ECEF] rounded-xl border border-[#E9ECEF]">
              {group.keys.map((key) => (
                <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {NOTIFICATION_PREF_LABELS[key]}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={prefs[key]}
                    onChange={() => toggle(key)}
                    disabled={NOTIFICATION_ALWAYS_SEND.has(key)}
                    aria-label={`${NOTIFICATION_PREF_LABELS[key]} — ${prefs[key] ? 'on' : 'off'}`}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {saved && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Notification preferences saved.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            Delivery history appears in the SMS log below.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save notification settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
