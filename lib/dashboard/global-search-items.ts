import type { GlobalSearchResult } from '@/lib/data/global-search'
import type { CommandItem } from '@/lib/dashboard/command-items'
import {
  BedDouble,
  Briefcase,
  Calendar,
  FileText,
  Search,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const KIND_ICONS: Record<GlobalSearchResult['kind'], LucideIcon> = {
  guest: Users,
  reservation: Calendar,
  room: BedDouble,
  complaint: Wrench,
  invoice: FileText,
  housekeeping: Briefcase,
}

const KIND_LABELS: Record<GlobalSearchResult['kind'], string> = {
  guest: 'Guest',
  reservation: 'Reservation',
  room: 'Room',
  complaint: 'Complaint',
  invoice: 'Invoice',
  housekeeping: 'Housekeeping',
}

export function globalResultsToCommandItems(results: GlobalSearchResult[]): CommandItem[] {
  return results.map((r) => ({
    id: `record-${r.id}`,
    label: r.label,
    description: r.subtitle,
    href: r.href,
    kind: 'record',
    keywords: [r.kind, r.label.toLowerCase()],
    icon: KIND_ICONS[r.kind] ?? Search,
    meta: KIND_LABELS[r.kind],
  }))
}
