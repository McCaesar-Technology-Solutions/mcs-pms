'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, MessageSquare } from 'lucide-react'
import { updateNotificationPreferences } from '@/app/actions/settings'
import {
  NOTIFICATION_PREF_GROUPS,
  NOTIFICATION_PREF_LABELS,
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
              Choose which automated texts are sent for this property. Security codes (2FA) are
              always sent.
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
                <li key={key} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {NOTIFICATION_PREF_LABELS[key]}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[key]}
                    onClick={() => toggle(key)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      prefs[key] ? 'bg-primary' : 'bg-[#D8D6DE]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        prefs[key] ? 'left-[1.375rem]' : 'left-0.5'
                      }`}
                    />
                  </button>
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
