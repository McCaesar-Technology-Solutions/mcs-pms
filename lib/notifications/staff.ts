import { sendToPhone, type SendResult } from '@/lib/notifications/send'
import { notifyEmails } from '@/lib/notifications/send-email'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { smsInviteUrl, smsLine, smsUrl } from '@/lib/notifications/sms-format'
import { appUrl } from '@/lib/notifications/app-url'

/** Technician invite — SMS and WhatsApp (when configured) with accept-invite link. */
export async function notifyStaffInvite(input: {
  hotelId: string
  phone: string
  role: 'technician'
  inviteToken: string
  hotelName?: string
}): Promise<SendResult[]> {
  if (!isSmsConfigured()) {
    return [{ channel: 'sms', success: false, error: 'SMS is not configured (set Arkesel or Hubtel keys).' }]
  }

  const property = input.hotelName?.trim() || 'MOJO Apartments'
  const body = smsLine(
    'MOJO:',
    `Tech invite at ${property}.`,
    smsInviteUrl(input.inviteToken),
  )

  return sendToPhone(input.phone, body, phoneNotifyOpts('staff_invite', { hotelId: input.hotelId }))
}

export async function notifyManagerAssignedToProperty(input: {
  hotelId: string
  hotelName: string
  phone?: string | null
  email?: string | null
}): Promise<void> {
  const property = input.hotelName.trim() || 'a property'
  const smsBody = smsLine('MOJO:', `You've been assigned to manage ${property}.`, smsUrl('/manager/dashboard'))

  await Promise.all([
    input.phone?.trim()
      ? sendToPhone(
          input.phone.trim(),
          smsBody,
          phoneNotifyOpts('staff_invite', { hotelId: input.hotelId }),
        )
      : Promise.resolve(),
    input.email?.trim()
      ? notifyEmails([input.email.trim().toLowerCase()], {
          subject: `Assigned to ${property}`,
          preview: 'You can manage this property with your existing login.',
          lines: [
            `You've been assigned to manage ${property}.`,
            'Use the same login. Ask the owner if you need this to be your working property.',
          ],
          actionUrl: appUrl('/manager/dashboard'),
          actionLabel: 'Open dashboard',
        }, {
          hotelId: input.hotelId,
          templateKey: 'staff_invite',
        })
      : Promise.resolve(),
  ])
}
