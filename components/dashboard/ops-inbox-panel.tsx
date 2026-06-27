'use client'

import Link from 'next/link'
import { Inbox, MessageCircle, Wrench, Bell, CheckCircle2, Sparkles } from 'lucide-react'
import type { OpsInboxItem } from '@/lib/data/ops-inbox'

const kindIcon = {
  complaint: Wrench,
  guest_request: Bell,
  guest_message: MessageCircle,
  guest_stay_chat: MessageCircle,
  housekeeping: Sparkles,
} as const

const kindIconWell: Record<OpsInboxItem['kind'], string> = {
  complaint: 'icon-well icon-well--coral',
  guest_request: 'icon-well icon-well--sand',
  guest_message: 'icon-well icon-well--sky',
  guest_stay_chat: 'icon-well icon-well--sky',
  housekeeping: 'icon-well icon-well--sage',
}

interface OpsInboxPanelProps {
  items: OpsInboxItem[]
}

export function OpsInboxPanel({ items }: OpsInboxPanelProps) {
  return (
    <div id="ops-inbox" className="surface-card overflow-hidden scroll-mt-24">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-[var(--comp-slate)]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Operations inbox</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Complaints, guest requests, and messages needing attention
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="list-empty flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-foreground">Inbox clear</p>
          <p className="text-sm text-muted-foreground">
            No open complaints, guest requests, or messages right now.
          </p>
        </div>
      ) : (
        <div className="list-stack">
          {items.map((item) => {
            const Icon = kindIcon[item.kind]
            return (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className="list-row"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${kindIconWell[item.kind]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
