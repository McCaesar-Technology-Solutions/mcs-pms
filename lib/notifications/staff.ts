import { sendToPhone, type SendResult } from '@/lib/notifications/send'
import { isSmsConfigured } from '@/lib/notifications/sms-provider'
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
  const link = appUrl(`/accept-invite?token=${input.inviteToken}`)

  const body = [
    `MOJO: You're invited to join ${property} as a technician.`,
    'Create your account:',
    link,
  ].join('\n')

  return sendToPhone(input.phone, body, {
    hotelId: input.hotelId,
    templateKey: 'staff_invite',
    includeWhatsApp: true,
  })
}
