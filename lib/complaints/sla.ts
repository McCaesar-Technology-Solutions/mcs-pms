import type { ComplaintPriority } from '@/types'

const SLA_HOURS: Record<ComplaintPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
}

export function computeComplaintSlaDueAt(
  priority: ComplaintPriority,
  submittedAt: Date = new Date(),
): string {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium
  return new Date(submittedAt.getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function isComplaintSlaBreached(
  slaDueAt: string | null | undefined,
  status: string,
): boolean {
  if (!slaDueAt) return false
  if (status === 'resolved' || status === 'rejected') return false
  return new Date(slaDueAt) < new Date()
}
