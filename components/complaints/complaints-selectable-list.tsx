'use client'

import type { LucideIcon } from 'lucide-react'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import type { Complaint, ComplaintCategory, ComplaintStatus } from '@/types'

const priorityAccent: Record<string, string> = {
  urgent: 'shadow-[inset_4px_0_0_0_#D85A30]',
  high: 'shadow-[inset_4px_0_0_0_#f97316]',
  medium: 'shadow-[inset_4px_0_0_0_#D4A62E]',
  low: 'shadow-[inset_4px_0_0_0_#cbd5e1]',
}

interface ComplaintsSelectableListProps {
  complaints: Complaint[]
  categoryIcons: Record<ComplaintCategory, LucideIcon>
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  onOpen: (complaint: Complaint) => void
  roomNumberOf: (c: Complaint) => string | null
  guestNameOf: (c: Complaint) => string | null
  statusBadge: (status: ComplaintStatus | null | undefined) => string
}

export function ComplaintsSelectableList({
  complaints,
  categoryIcons,
  isSelected,
  onToggle,
  onOpen,
  roomNumberOf,
  guestNameOf,
  statusBadge,
}: ComplaintsSelectableListProps) {
  return (
    <div className="space-y-2">
      {complaints.map((c) => {
        const Icon = categoryIcons[c.category]
        const selected = isSelected(c.id)
        return (
          <div
            key={c.id}
            className={`flex w-full items-stretch gap-3 rounded-2xl bg-white shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2 ${priorityAccent[c.priority ?? 'medium']} ${
              selected ? 'ring-2 ring-primary/25' : ''
            }`}
          >
            <div className="flex items-center pl-4">
              <BulkSelectCheckbox
                checked={selected}
                onChange={() => onToggle(c.id)}
                aria-label={`Select complaint ${c.category}`}
              />
            </div>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pr-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3C216C]/6">
                <Icon className="h-5 w-5 text-[#3C216C]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <p className="font-semibold capitalize text-foreground">{c.category}</p>
                  {roomNumberOf(c) && (
                    <span className="rounded-md bg-[#3C216C]/8 px-2 py-0.5 text-[11px] font-semibold text-[#3C216C]">
                      Room {roomNumberOf(c)}
                    </span>
                  )}
                  {guestNameOf(c) && (
                    <span className="text-xs text-muted-foreground">{guestNameOf(c)}</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{c.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c.status)}`}
              >
                {c.status?.replace('_', ' ')}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
