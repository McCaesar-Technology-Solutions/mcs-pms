import { sendToPhone, type SendResult } from '@/lib/notifications/send'
import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { smsInviteUrl, smsLine } from '@/lib/notifications/sms-format'

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

  return sendToPhone(input.phone, body, {
    hotelId: input.hotelId,
    templateKey: 'staff_invite',
    includeWhatsApp: true,
  })
}
