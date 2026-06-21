'use client'

import { useEffect, useState, useTransition } from 'react'
import { Mail } from 'lucide-react'
import { updateEmailNotificationPreferences } from '@/app/actions/settings'
import {
  EMAIL_PREF_GROUPS,
  EMAIL_PREF_LABELS,
  mergeEmailPrefs,
  type EmailStaffTemplateKey,
  type NotificationEmailPrefs,
} from '@/lib/notifications/email-preferences'

interface EmailNotificationPreferencesPanelProps {
  hotelId: string
  initialPrefs?: NotificationEmailPrefs | null
}

export function EmailNotificationPreferencesPanel({
  hotelId,
  initialPrefs,
}: EmailNotificationPreferencesPanelProps) {
  const [prefs, setPrefs] = useState(() => mergeEmailPrefs(initialPrefs))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPrefs(mergeEmailPrefs(initialPrefs))
    setError(null)
    setSaved(false)
  }, [hotelId, initialPrefs])

  function toggle(key: EmailStaffTemplateKey) {
    setPrefs((current) => ({ ...current, [key]: !current[key] }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateEmailNotificationPreferences({ hotelId, prefs })
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
          <Mail className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Email notifications</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Alerts sent to owner and manager email addresses on file. Requires{' '}
              <code className="text-xs">RESEND_API_KEY</code> in your environment.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {EMAIL_PREF_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-3">
              <p className="font-semibold text-foreground">{group.title}</p>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>
            <ul className="divide-y divide-[#E9ECEF] rounded-xl border border-[#E9ECEF]">
              {group.keys.map((key) => (
                <li key={key} className="flex items-start justify-between gap-4 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{EMAIL_PREF_LABELS[key]}</p>
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
            Email preferences saved.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save email settings'}
        </button>
      </div>
    </div>
  )
}
