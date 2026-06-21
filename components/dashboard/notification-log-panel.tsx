'use client'

import { MessageSquare, Smartphone, Mail } from 'lucide-react'
import type { NotificationLogEntry } from '@/lib/data/notification-log'

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusClass(status: NotificationLogEntry['status']) {
  switch (status) {
    case 'sent':
      return 'bg-emerald-500/10 text-emerald-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-[#E9ECEF] text-[#5E5872]'
  }
}

interface NotificationLogPanelProps {
  entries: NotificationLogEntry[]
  compact?: boolean
}

export function NotificationLogPanel({ entries, compact = false }: NotificationLogPanelProps) {
  return (
    <div id="sms-log" className="surface-card overflow-hidden scroll-mt-24">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">SMS, email & WhatsApp log</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Recent outbound messages from the system.
            </p>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No messages logged yet. Alerts appear here when SMS or WhatsApp is sent.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">When</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">To</th>
                {!compact && (
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Template</th>
                )}
                <th className="px-4 py-3 text-left font-semibold text-foreground">Channel</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                {!compact && (
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Message</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#FAFDFF]">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatWhen(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {entry.recipientEmail ?? entry.recipientPhone ?? '—'}
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-foreground">{entry.templateKey}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      {entry.channel === 'whatsapp' ? (
                        <MessageSquare className="h-3.5 w-3.5" />
                      ) : entry.channel === 'email' ? (
                        <Mail className="h-3.5 w-3.5" />
                      ) : (
                        <Smartphone className="h-3.5 w-3.5" />
                      )}
                      {entry.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(entry.status)}`}
                    >
                      {entry.status}
                    </span>
                    {entry.status === 'failed' && entry.errorMessage && !compact && (
                      <p className="mt-1 text-xs text-red-600">{entry.errorMessage}</p>
                    )}
                  </td>
                  {!compact && (
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      <p className="line-clamp-2">{entry.body}</p>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
