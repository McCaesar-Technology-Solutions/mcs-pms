import { notifyPhones } from '@/lib/notifications/send'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { notifyEmails } from '@/lib/notifications/send-email'
import { ownerEmails, ownerPhones } from '@/lib/notifications/recipients'
import { appUrl } from '@/lib/notifications/app-url'
import { smsLine, smsRoom, smsUrl } from '@/lib/notifications/sms-format'
import type { StaffEmailContent } from '@/lib/notifications/email-template'

/** SMS and email to the property owner (via hotels.owner_id). */
export async function notifyOwner(input: {
  hotelId: string
  templateKey: string
  smsBody: string
  email: StaffEmailContent
}): Promise<void> {
  const [phones, emails] = await Promise.all([
    ownerPhones(input.hotelId),
    ownerEmails(input.hotelId),
  ])

  await Promise.all([
    phones.length > 0
      ? notifyPhones(phones, input.smsBody, phoneNotifyOpts(input.templateKey, { hotelId: input.hotelId }))
      : Promise.resolve(),
    emails.length > 0
      ? notifyEmails(emails, input.email, {
          hotelId: input.hotelId,
          templateKey: input.templateKey,
        })
      : Promise.resolve(),
  ])
}

export async function notifyOwnerRoomCreated(input: {
  hotelId: string
  roomNumber: string
  managerName: string
  floor: number
  nightlyRate: number
  categoryName?: string | null
}): Promise<void> {
  const categoryPart = input.categoryName ? `, ${input.categoryName}` : ''
  const smsBody = smsLine(
    'MOJO:',
    `New ${smsRoom(input.roomNumber)} fl ${input.floor}${categoryPart}.`,
    `By ${input.managerName}.`,
    smsUrl('/owner/rooms'),
  )

  const email: StaffEmailContent = {
    subject: `New room ${input.roomNumber} added`,
    preview: `${input.managerName} added Room ${input.roomNumber} to your property.`,
    lines: [
      `${input.managerName} created Room ${input.roomNumber} on floor ${input.floor}.`,
      ...(input.categoryName ? [`Category: ${input.categoryName}`] : []),
      `Nightly rate: GHS ${input.nightlyRate.toLocaleString()}`,
    ],
    actionUrl: appUrl('/owner/rooms'),
    actionLabel: 'View rooms',
  }

  await notifyOwner({
    hotelId: input.hotelId,
    templateKey: 'room_created',
    smsBody,
    email,
  })
}
