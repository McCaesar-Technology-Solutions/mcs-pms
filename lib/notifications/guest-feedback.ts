import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPhones } from '@/lib/notifications/send'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { notifyEmails } from '@/lib/notifications/send-email'
import {
  managerOnlyEmails,
  managerOnlyPhones,
  ownerEmails,
  ownerPhones,
} from '@/lib/notifications/recipients'
import { appUrl } from '@/lib/notifications/app-url'
import { smsLine, smsTruncate, smsUrl } from '@/lib/notifications/sms-format'
import type { StaffEmailContent } from '@/lib/notifications/email-template'

const LOW_RATING_THRESHOLD = 2

const OWNER_REVIEWS_URL = '/owner/dashboard#guest-feedback'
const MANAGER_REVIEWS_URL = '/manager/dashboard#guest-feedback'

async function notifyGuestFeedbackEmails(input: {
  hotelId: string
  templateKey: string
  email: Omit<StaffEmailContent, 'actionUrl' | 'actionLabel'>
}): Promise<void> {
  const [managerEmails, ownerEmailList] = await Promise.all([
    managerOnlyEmails(input.hotelId),
    ownerEmails(input.hotelId),
  ])

  const emailBase = { ...input.email, actionLabel: 'View reviews' as const }

  await Promise.all([
    managerEmails.length > 0
      ? notifyEmails(
          managerEmails,
          { ...emailBase, actionUrl: appUrl(MANAGER_REVIEWS_URL) },
          { hotelId: input.hotelId, templateKey: input.templateKey },
        )
      : Promise.resolve(),
    ownerEmailList.length > 0
      ? notifyEmails(
          ownerEmailList,
          { ...emailBase, actionUrl: appUrl(OWNER_REVIEWS_URL) },
          { hotelId: input.hotelId, templateKey: input.templateKey },
        )
      : Promise.resolve(),
  ])
}

export async function notifyGuestFeedbackSubmitted(feedbackId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guest_feedback')
    .select('id, rating, comment, hotel_id, guests(name, rooms(number))')
    .eq('id', feedbackId)
    .maybeSingle()

  if (!data?.hotel_id) return

  const guest = data.guests as { name?: string; rooms?: { number?: string } | null } | null
  const guestName = guest?.name ?? 'Guest'
  const room = guest?.rooms?.number ? `Room ${guest.rooms.number}` : null
  const stars = `${data.rating}/5`
  const commentLine = data.comment?.trim() ? `"${data.comment.trim().slice(0, 160)}"` : null

  const isLow = data.rating <= LOW_RATING_THRESHOLD
  const templateKey = isLow ? 'guest_feedback_low' : 'guest_feedback'

  if (!isLow) {
    await notifyGuestFeedbackEmails({
      hotelId: data.hotel_id,
      templateKey,
      email: {
        subject: `Guest review · ${stars} from ${guestName}`,
        preview: `${guestName} left a ${stars} review.`,
        lines: [
          `${guestName}${room ? ` · ${room}` : ''} rated their stay ${stars}.`,
          ...(commentLine ? [commentLine] : []),
        ],
      },
    })
    return
  }

  const smsBody = smsLine(
    'MOJO:',
    `Low review (${stars})`,
    `${guestName}${room ? `, ${room.replace('Room ', 'Rm ')}` : ''}`,
    commentLine ? smsTruncate(commentLine.replace(/^"|"$/g, ''), 60) : null,
  )

  const [managerPhones, ownerPhoneList] = await Promise.all([
    managerOnlyPhones(data.hotel_id),
    ownerPhones(data.hotel_id),
  ])

  await Promise.all([
    notifyGuestFeedbackEmails({
      hotelId: data.hotel_id,
      templateKey,
      email: {
        subject: `Low guest review · ${stars} from ${guestName}`,
        preview: `${guestName} left a ${stars} review — please follow up.`,
        lines: [
          `${guestName}${room ? ` · ${room}` : ''} rated their stay ${stars}.`,
          ...(commentLine ? [commentLine] : []),
        ],
      },
    }),
    managerPhones.length > 0
      ? notifyPhones(
          managerPhones,
          `${smsBody} ${smsUrl(MANAGER_REVIEWS_URL)}`,
          phoneNotifyOpts(templateKey, { hotelId: data.hotel_id }),
        )
      : Promise.resolve(),
    ownerPhoneList.length > 0
      ? notifyPhones(
          ownerPhoneList,
          `${smsBody} ${smsUrl(OWNER_REVIEWS_URL)}`,
          phoneNotifyOpts(templateKey, { hotelId: data.hotel_id }),
        )
      : Promise.resolve(),
  ])
}
