import type { Complaint } from '@/types'

export function complaintMatchesQuery(c: Complaint, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = [
    c.description,
    c.category,
    c.rooms?.number,
    c.room?.number,
    c.guests?.name,
    c.guest?.name,
    c.status,
    c.priority,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}
