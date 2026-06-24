import { notifyPhones } from '@/lib/notifications/send'
import { notifyEmails } from '@/lib/notifications/send-email'
import { ownerEmails, ownerPhones } from '@/lib/notifications/recipients'
import { appUrl } from '@/lib/notifications/app-url'
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
      ? notifyPhones(phones, input.smsBody, {
          hotelId: input.hotelId,
          templateKey: input.templateKey,
          includeWhatsApp: false,
        })
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
  const categoryPart = input.categoryName ? ` · ${input.categoryName}` : ''
  const smsBody = [
    'MOJO: New room added',
    `Room ${input.roomNumber} (floor ${input.floor})${categoryPart}`,
    `Added by ${input.managerName}`,
    appUrl('/owner/rooms'),
  ].join('\n')

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
