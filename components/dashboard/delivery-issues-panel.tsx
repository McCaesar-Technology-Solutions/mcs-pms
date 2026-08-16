import { AlertTriangle } from 'lucide-react'
import type { DeadNotificationRow } from '@/lib/data/notification-outbox'

const CHANNEL_LABEL: Record<DeadNotificationRow['channel'], string> = {
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

interface DeliveryIssuesPanelProps {
  items: DeadNotificationRow[]
}

export function DeliveryIssuesPanel({ items }: DeliveryIssuesPanelProps) {
  return (
    <div className="surface-card">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Delivery issues</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              SMS, email, and WhatsApp that gave up after retries (booking confirmations, receipts,
              door PIN messages).
            </p>
          </div>
        </div>
      </div>
      <div className="surface-card-body">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed deliveries on file.</p>
        ) : (
          <ul className="soft-list">
            {items.map((item) => (
              <li key={item.id} className="soft-list-item flex flex-col gap-1 px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {CHANNEL_LABEL[item.channel]} · {item.recipientMasked}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.templateKey}</p>
                {item.lastError ? (
                  <p className="text-xs text-destructive">{item.lastError}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
