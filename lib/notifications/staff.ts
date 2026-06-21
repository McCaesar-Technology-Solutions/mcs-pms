import { notifyPhones } from '@/lib/notifications/send'
import { appUrl } from '@/lib/notifications/app-url'

/** Technician invite — SMS with accept-invite link. */
export async function notifyStaffInvite(input: {
  hotelId: string
  phone: string
  role: 'technician'
  inviteToken: string
  hotelName?: string
}): Promise<void> {
  const property = input.hotelName?.trim() || 'MOJO Apartments'
  const link = appUrl(`/accept-invite?token=${input.inviteToken}`)

  const body = [
    `MOJO: You're invited to join ${property} as a technician.`,
    'Create your account:',
    link,
  ].join('\n')

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'staff_invite',
    includeWhatsApp: false,
  })
}
