import { notifyEmails } from '@/lib/notifications/send-email'
import { appUrl } from '@/lib/notifications/app-url'

/** Manager or receptionist invite — email with accept-invite link. */
export async function notifyStaffInviteEmail(input: {
  hotelId: string
  email: string
  role: 'manager' | 'receptionist'
  inviteToken: string
  hotelName?: string
}): Promise<void> {
  const property = input.hotelName?.trim() || 'MOJO Apartments'
  const roleLabel = input.role === 'manager' ? 'manager' : 'receptionist'
  const link = appUrl(`/accept-invite?token=${input.inviteToken}`)

  await notifyEmails(
    [input.email],
    {
      subject: `You're invited to join ${property}`,
      preview: `Create your ${roleLabel} account for ${property}.`,
      lines: [
        `You've been invited to join ${property} as a ${roleLabel}.`,
        'Click below to create your account and get started.',
      ],
      actionUrl: link,
      actionLabel: 'Accept invite',
    },
    {
      hotelId: input.hotelId,
      templateKey: 'staff_invite',
    },
  )
}
