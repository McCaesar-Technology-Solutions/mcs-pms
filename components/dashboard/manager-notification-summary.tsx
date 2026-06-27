'use client'

import Link from 'next/link'
import { Bell, Mail } from 'lucide-react'
import {
  EMAIL_PREF_GROUPS,
  EMAIL_PREF_LABELS,
  mergeEmailPrefs,
  type NotificationEmailPrefs,
} from '@/lib/notifications/email-preferences'
import {
  NOTIFICATION_PREF_GROUPS,
  NOTIFICATION_PREF_LABELS,
  mergeNotificationPrefs,
  type NotificationSmsPrefs,
} from '@/lib/notifications/preferences'

interface ManagerNotificationSummaryProps {
  smsPrefs: NotificationSmsPrefs | null
  emailPrefs: NotificationEmailPrefs | null
}

export function ManagerNotificationSummary({
  smsPrefs,
  emailPrefs,
}: ManagerNotificationSummaryProps) {
  const sms = mergeNotificationPrefs(smsPrefs)
  const email = mergeEmailPrefs(emailPrefs)
  const smsOn = Object.values(sms).filter(Boolean).length
  const emailOn = Object.values(email).filter(Boolean).length

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[var(--comp-slate)]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Notification settings</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {smsOn} SMS alerts and {emailOn} email alerts are enabled for this property.
              Contact the owner to change these.
            </p>
          </div>
        </div>
      </div>
      <div className="surface-card-body">
        <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> SMS
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {NOTIFICATION_PREF_GROUPS.flatMap((g) => g.keys)
              .slice(0, 6)
              .map((key) => (
                <li key={key} className="flex justify-between gap-2">
                  <span>{NOTIFICATION_PREF_LABELS[key]}</span>
                  <span className={sms[key] ? 'text-emerald-600' : 'text-muted-foreground/50'}>
                    {sms[key] ? 'On' : 'Off'}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Email
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {EMAIL_PREF_GROUPS.flatMap((g) => g.keys)
              .slice(0, 6)
              .map((key) => (
                <li key={key} className="flex justify-between gap-2">
                  <span>{EMAIL_PREF_LABELS[key]}</span>
                  <span className={email[key] ? 'text-emerald-600' : 'text-muted-foreground/50'}>
                    {email[key] ? 'On' : 'Off'}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        </div>
      </div>
      <div className="surface-card-footer">
        Contact the property owner to change alert preferences. View recent deliveries on the{' '}
        <Link
          href="/manager/dashboard#sms-log"
          className="font-semibold text-[var(--comp-teal)] hover:underline"
        >
          Activity tab
        </Link>
        .
      </div>
    </div>
  )
}
