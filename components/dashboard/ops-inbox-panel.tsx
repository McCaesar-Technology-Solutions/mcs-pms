'use client'

import Link from 'next/link'
import { Inbox, MessageCircle, Wrench, Bell, CheckCircle2 } from 'lucide-react'
import type { OpsInboxItem } from '@/lib/data/ops-inbox'

const kindIcon = {
  complaint: Wrench,
  guest_request: Bell,
  guest_message: MessageCircle,
} as const

interface OpsInboxPanelProps {
  items: OpsInboxItem[]
}

export function OpsInboxPanel({ items }: OpsInboxPanelProps) {
  return (
    <div id="ops-inbox" className="surface-card overflow-hidden scroll-mt-24">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Operations inbox</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Complaints, guest requests, and messages needing attention
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-foreground">Inbox clear</p>
          <p className="text-sm text-muted-foreground">
            No open complaints, guest requests, or messages right now.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {items.map((item) => {
            const Icon = kindIcon[item.kind]
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-muted/40"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3C216C]/8 text-[#3C216C]">
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
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
