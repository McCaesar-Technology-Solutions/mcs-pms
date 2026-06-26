import { notifyPhones } from '@/lib/notifications/send'
import { notifyManagers } from '@/lib/notifications/manager-notify'
import { smsLine, smsRoom, smsTruncate, smsUrl } from '@/lib/notifications/sms-format'
import { appUrl } from '@/lib/notifications/app-url'

/** Guest sent a stay chat message — alert managers. */
export async function notifyGuestStayMessageToManagers(input: {
  hotelId: string
  guestName: string
  roomNumber: string | null
  messagePreview: string
  conversationId: string
}): Promise<void> {
  const preview = input.messagePreview.slice(0, 120)
  const smsBody = smsLine(
    'MOJO:',
    'Guest message',
    input.guestName,
    smsRoom(input.roomNumber),
    smsTruncate(preview, 80),
    smsUrl('/manager/messages'),
  )

  await notifyManagers({
    hotelId: input.hotelId,
    templateKey: 'guest_stay_chat',
    smsBody,
    email: {
      subject: `Message from ${input.guestName}`,
      preview: `${input.guestName}${input.roomNumber ? ` (Room ${input.roomNumber})` : ''}: "${preview}"`,
      lines: [
        `${input.guestName}${input.roomNumber ? ` · Room ${input.roomNumber}` : ''} sent a message in the guest portal.`,
        `"${preview}"`,
      ],
      actionUrl: appUrl(`/manager/messages?conversation=${input.conversationId}`),
      actionLabel: 'Open messages',
    },
  })
}

/** Staff replied in stay chat — alert guest via SMS/email. */
export async function notifyStaffStayMessageToGuest(input: {
  hotelId: string
  guestId: string
  guestPhone: string | null
  messagePreview: string
}): Promise<void> {
  const preview = input.messagePreview.slice(0, 120)
  const smsBody = smsLine(
    'MOJO:',
    'Team message',
    smsTruncate(preview, 80),
    smsUrl('/guest'),
  )

  if (input.guestPhone) {
    await notifyPhones([input.guestPhone], smsBody, {
      hotelId: input.hotelId,
      templateKey: 'guest_stay_chat',
      includeWhatsApp: false,
    })
  }

  const { notifyGuestEmail } = await import('@/lib/notifications/guest-email')
  void notifyGuestEmail(input.guestId, 'guest_stay_message', {
    subject: 'Message from the front desk',
    preview,
    lines: [`"${preview}"`, 'Open your guest portal to reply.'],
    actionUrl: appUrl('/guest'),
    actionLabel: 'Open guest portal',
  })
}
