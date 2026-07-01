import { notifyPhones } from '@/lib/notifications/send'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { notifyEmails } from '@/lib/notifications/send-email'
import { hotelStaffEmails, hotelStaffPhones } from '@/lib/notifications/recipients'
import { appUrl } from '@/lib/notifications/app-url'
import { smsLine, smsUrl } from '@/lib/notifications/sms-format'
import type { StaffEmailContent } from '@/lib/notifications/email-template'
import {
  formatOpsEventWhen,
  isImportantOpsCategory,
  OPS_EVENT_LABELS,
} from '@/lib/ops-calendar/categories'
import { postPropertyTeamAnnouncement } from '@/lib/staff/property-team-channel'

export interface OpsCalendarNotifyInput {
  hotelId: string
  authorId: string
  authorName: string
  title: string
  category: string
  startsAt: string
  allDay: boolean
  roomNumber?: string | null
  notes?: string | null
  notifyTeam: boolean
  dashboardPath?: string
}

function teamMessageBody(input: OpsCalendarNotifyInput): string {
  const when = formatOpsEventWhen(input.startsAt, input.allDay)
  const category = OPS_EVENT_LABELS[input.category] ?? input.category
  const roomPart = input.roomNumber ? ` · Room ${input.roomNumber}` : ''
  const notesPart = input.notes?.trim() ? `\n${input.notes.trim()}` : ''
  return `📅 Ops calendar: ${input.title}\n${when} · ${category}${roomPart}${notesPart}`
}

export async function notifyOpsCalendarEventCreated(input: OpsCalendarNotifyInput): Promise<void> {
  const when = formatOpsEventWhen(input.startsAt, input.allDay)
  const category = OPS_EVENT_LABELS[input.category] ?? input.category
  const dashboardPath = input.dashboardPath ?? '/manager/dashboard'

  if (input.notifyTeam) {
    const smsBody = smsLine(
      'MOJO:',
      `Calendar: ${input.title}`,
      `${when} · ${category}.`,
      `By ${input.authorName}.`,
      smsUrl(dashboardPath),
    )

    const email: StaffEmailContent = {
      subject: `Scheduled: ${input.title}`,
      preview: `${input.authorName} added “${input.title}” to the ops calendar.`,
      lines: [
        `When: ${when}`,
        `Category: ${category}`,
        ...(input.roomNumber ? [`Room: ${input.roomNumber}`] : []),
        ...(input.notes?.trim() ? [input.notes.trim()] : []),
      ],
      actionUrl: appUrl(dashboardPath),
      actionLabel: 'View dashboard',
    }

    const [phones, emails] = await Promise.all([
      hotelStaffPhones(input.hotelId, input.authorId),
      hotelStaffEmails(input.hotelId, input.authorId),
    ])

    await Promise.all([
      phones.length > 0
        ? notifyPhones(
            phones,
            smsBody,
            phoneNotifyOpts('ops_calendar_event', { hotelId: input.hotelId }),
          )
        : Promise.resolve(),
      emails.length > 0
        ? notifyEmails(emails, email, {
            hotelId: input.hotelId,
            templateKey: 'ops_calendar_event',
          })
        : Promise.resolve(),
    ])
  }

  if (isImportantOpsCategory(input.category)) {
    await postPropertyTeamAnnouncement({
      hotelId: input.hotelId,
      authorId: input.authorId,
      body: teamMessageBody(input),
    })
  }
}

export { isImportantOpsCategory }
