import { notifyPhones } from '@/lib/notifications/send'
import { notifyEmails } from '@/lib/notifications/send-email'
import { managerEmails, managerPhones } from '@/lib/notifications/recipients'
import type { StaffEmailContent } from '@/lib/notifications/email-template'

/** Send SMS (if phones on file) and email (if configured) to managers — falls back to owner. */
export async function notifyManagers(input: {
  hotelId: string
  templateKey: string
  smsBody: string
  email: StaffEmailContent
}): Promise<void> {
  const [phones, emails] = await Promise.all([
    managerPhones(input.hotelId),
    managerEmails(input.hotelId),
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
