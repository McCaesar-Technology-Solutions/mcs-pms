import type { EmailSendResult } from '@/lib/notifications/send-email'
import { isEmailConfigured } from '@/lib/notifications/email-provider'
import { enqueueEmailOutbox } from '@/lib/notifications/outbox'
import { reportNotificationFailure } from '@/lib/notifications/notify-failure'
import { appUrl } from '@/lib/notifications/app-url'

/** Manager or receptionist invite — email with accept-invite link. */
export async function notifyStaffInviteEmail(input: {
  hotelId: string
  email: string
  role: 'manager' | 'receptionist'
  inviteToken: string
  hotelName?: string
}): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email is not configured (set RESEND_API_KEY on the server).' }
  }

  const property = input.hotelName?.trim() || 'MOJO Apartments'
  const roleLabel = input.role === 'manager' ? 'manager' : 'receptionist'
  const link = appUrl(`/accept-invite?token=${input.inviteToken}`)

  const content = {
    subject: `You're invited to join ${property}`,
    preview: `Create your ${roleLabel} account for ${property}.`,
    lines: [
      `You've been invited to join ${property} as a ${roleLabel}.`,
      'Click below to create your account and get started.',
    ],
    actionUrl: link,
    actionLabel: 'Accept invite',
  }

  const { sendToEmail } = await import('@/lib/notifications/send-email')
  const result = await sendToEmail(input.email, content, {
    hotelId: input.hotelId,
    templateKey: 'staff_invite',
  })

  if (
    !result.success &&
    result.providerId !== 'skipped-pref' &&
    result.providerId !== 'dev-log'
  ) {
    try {
      await enqueueEmailOutbox({
        hotelId: input.hotelId,
        email: input.email,
        content,
        templateKey: 'staff_invite',
        idempotencyKey: `staff_invite:${input.inviteToken}`,
      })
    } catch (enqueueErr) {
      const enqueueMessage =
        enqueueErr instanceof Error ? enqueueErr.message : 'Outbox enqueue failed'
      reportNotificationFailure({
        templateKey: 'staff_invite',
        hotelId: input.hotelId,
        channel: 'email',
        recipient: input.email,
        error: `${result.error ?? 'Email send failed'}; enqueue: ${enqueueMessage}`,
        stage: 'send',
      })
      return { success: false, error: result.error ?? 'Could not send the invite email.' }
    }

    reportNotificationFailure({
      templateKey: 'staff_invite',
      hotelId: input.hotelId,
      channel: 'email',
      recipient: input.email,
      error: result.error,
      stage: 'outbox_retry',
    })
  }

  return result
}
