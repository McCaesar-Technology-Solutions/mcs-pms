import { appUrl } from '@/lib/notifications/app-url'

/** Opens the manager complaints sheet on a specific guest thread. */
export function managerComplaintChatUrl(complaintId: string): string {
  const params = new URLSearchParams({ complaint: complaintId })
  return appUrl(`/manager/complaints?${params.toString()}`)
}
