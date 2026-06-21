import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailConfigured, resolveEmailFrom } from '@/lib/notifications/email-provider'
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

async function logEmailNotification(
  opts: EmailNotifyOptions,
  email: string,
  body: string,
  result: EmailSendResult,
): Promise<void> {
  if (!opts.hotelId) return
  try {
    const admin = createAdminClient()
    await admin.from('notification_log').insert({
      hotel_id: opts.hotelId,
      recipient_phone: null,
      recipient_email: email,
      channel: 'email',
      template_key: opts.templateKey,
      body,
      provider: 'resend',
      provider_id: result.providerId ?? null,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error ?? null,
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

  if (!(await shouldSendHotelEmailNotification(opts.hotelId, opts.templateKey))) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[email:${opts.templateKey}] skipped (disabled for hotel)`)
    }
    return { success: true, providerId: 'skipped-pref' }
  }

  const { html, text } = renderStaffEmail(content)

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[email:${opts.templateKey}] → ${email}\n${text}`)
    }
    return { success: true, providerId: 'dev-log' }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const { data, error } = await resend.emails.send({
      from: resolveEmailFrom(),
      to: email,
      subject: content.subject,
      html,
      text,
    })

    if (error) {
      const result = { success: false, error: error.message }
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
