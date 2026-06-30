import { isProd } from '@/lib/env'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isEmailConfigured,
  isResendSandboxFrom,
  resolveEmailFromForHotel,
} from '@/lib/notifications/email-provider'
import { renderStaffEmail, type StaffEmailContent } from '@/lib/notifications/email-template'
import { shouldSendHotelEmailNotification } from '@/lib/notifications/recipients'

export interface EmailSendResult {
  success: boolean
  providerId?: string
  error?: string
}

export interface EmailNotifyOptions {
  hotelId?: string
  templateKey: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function humanizeResendError(message: string, from: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('only send testing emails to your own email') ||
    lower.includes('verify a domain at resend.com')
  ) {
    const sandboxNote = isResendSandboxFrom(from)
      ? ' You are using the Resend sandbox sender (onboarding@resend.dev), which only delivers to the email on your Resend account.'
      : ''
    return `Email could not be delivered to this recipient.${sandboxNote} Verify a domain at resend.com/domains, set RESEND_FROM to an address on that domain (and in Settings → Email notifications), then redeploy.`
  }
  return message
}

async function logEmailNotification(
  opts: EmailNotifyOptions,
  email: string,
  body: string,
  result: EmailSendResult & { status?: 'sent' | 'failed' | 'skipped' },
): Promise<void> {
  if (!opts.hotelId) return
  try {
    const admin = createAdminClient()
    const status =
      result.status ??
      (result.providerId === 'skipped-pref'
        ? 'skipped'
        : result.success
          ? 'sent'
          : 'failed')
    await admin.from('notification_log').insert({
      hotel_id: opts.hotelId,
      recipient_phone: null,
      recipient_email: email,
      channel: 'email',
      template_key: opts.templateKey,
      body,
      provider: status === 'skipped' ? 'pref' : 'resend',
      provider_id: result.providerId ?? null,
      status,
      error_message:
        status === 'skipped' ? 'Disabled in notification settings' : (result.error ?? null),
    })
  } catch {
    // Non-blocking
  }
}

export async function sendToEmail(
  rawEmail: string,
  content: StaffEmailContent,
  opts: EmailNotifyOptions,
): Promise<EmailSendResult> {
  const email = rawEmail.trim().toLowerCase()
  if (!isValidEmail(email)) return { success: false, error: 'Invalid email address' }

  const { html, text } = renderStaffEmail(content)

  if (!(await shouldSendHotelEmailNotification(opts.hotelId, opts.templateKey))) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[email:${opts.templateKey}] skipped (disabled for hotel)`)
    }
    const skipped: EmailSendResult = { success: true, providerId: 'skipped-pref' }
    if (opts.hotelId) {
      await logEmailNotification(opts, email, text, { ...skipped, status: 'skipped' })
    }
    return skipped
  }

  if (!isEmailConfigured()) {
    if (isProd()) {
      const failed: EmailSendResult = {
        success: false,
        error: 'Email provider is not configured',
      }
      if (opts.hotelId) {
        await logEmailNotification(opts, email, text, { ...failed, status: 'failed' })
      }
      return failed
    }
    if (process.env.NODE_ENV === 'development') {
      console.info(`[email:${opts.templateKey}] → ${email}\n${text}`)
    }
    return { success: true, providerId: 'dev-log' }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const from = await resolveEmailFromForHotel(opts.hotelId)
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: content.subject,
      html,
      text,
    })

    if (error) {
      const result = {
        success: false,
        error: humanizeResendError(error.message, from),
      }
      if (process.env.NODE_ENV === 'development') {
        console.error(`[email:${opts.templateKey}] Resend error → ${email}:`, error.message)
      }
      await logEmailNotification(opts, email, text, result)
      return result
    }

    const result = { success: true, providerId: data?.id }
    await logEmailNotification(opts, email, text, result)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    const result = { success: false, error: message }
    await logEmailNotification(opts, email, text, result)
    return result
  }
}

export async function notifyEmails(
  emails: string[],
  content: StaffEmailContent,
  opts: EmailNotifyOptions,
): Promise<void> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(isValidEmail))]
  await Promise.all(unique.map((email) => sendToEmail(email, content, opts)))
}
