'use client'

import { useEffect, useState, useTransition } from 'react'
import { Mail } from 'lucide-react'
import { updateEmailNotificationPreferences } from '@/app/actions/settings'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import {
  EMAIL_PREF_GROUPS,
  EMAIL_PREF_LABELS,
  EMAIL_ALWAYS_SEND,
  mergeEmailPrefs,
  type EmailStaffTemplateKey,
  type NotificationEmailPrefs,
} from '@/lib/notifications/email-preferences'

interface EmailNotificationPreferencesPanelProps {
  hotelId: string
  propertyName: string
  initialPrefs?: NotificationEmailPrefs | null
  initialFromEmail?: string | null
}

export function EmailNotificationPreferencesPanel({
  hotelId,
  propertyName,
  initialPrefs,
  initialFromEmail,
}: EmailNotificationPreferencesPanelProps) {
  const [prefs, setPrefs] = useState(() => mergeEmailPrefs(initialPrefs))
  const [fromEmail, setFromEmail] = useState(initialFromEmail ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPrefs(mergeEmailPrefs(initialPrefs))
    setFromEmail(initialFromEmail ?? '')
    setError(null)
    setSaved(false)
  }, [hotelId, initialPrefs, initialFromEmail])

  function toggle(key: EmailStaffTemplateKey) {
    if (EMAIL_ALWAYS_SEND.has(key)) return
    setPrefs((current) => ({ ...current, [key]: !current[key] }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateEmailNotificationPreferences({
        hotelId,
        prefs,
        notificationFromEmail: fromEmail.trim(),
      })
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
              Set the sender address for this property and choose which alerts go out. Requires{' '}
              <code className="text-xs">RESEND_API_KEY</code>. The address must be on a domain
              verified in Resend.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-[#E9ECEF] bg-[#FAFDFF] p-4">
          <label htmlFor="notification-from-email" className="text-sm font-semibold text-foreground">
            Sender email address
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Guests and staff will see emails from{' '}
            <span className="font-medium text-foreground">
              {propertyName.trim() || 'Your property'}
            </span>
            {fromEmail.trim() ? (
              <>
                {' '}
                &lt;{fromEmail.trim().toLowerCase()}&gt;
              </>
            ) : (
              ' using the server default (RESEND_FROM or Resend sandbox)'
            )}
            .
          </p>
          <input
            id="notification-from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => {
              setFromEmail(e.target.value)
              setSaved(false)
            }}
            placeholder="alerts@yourdomain.com"
            className="input-soft mt-3"
          />
        </div>

        {EMAIL_PREF_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-3">
              <p className="font-semibold text-foreground">{group.title}</p>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>
            <ul className="divide-y divide-[#E9ECEF] rounded-xl border border-[#E9ECEF]">
              {group.keys.map((key) => (
                <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <p className="text-sm font-medium text-foreground">{EMAIL_PREF_LABELS[key]}</p>
                  <ToggleSwitch
                    checked={prefs[key]}
                    onChange={() => toggle(key)}
                    disabled={EMAIL_ALWAYS_SEND.has(key)}
                    aria-label={`${EMAIL_PREF_LABELS[key]} — ${prefs[key] ? 'on' : 'off'}`}
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
