import { createAdminClient } from '@/lib/supabase/admin'
import { sendToEmail } from '@/lib/notifications/send-email'
import { appUrl } from '@/lib/notifications/app-url'
import type { StaffEmailContent } from '@/lib/notifications/email-template'

export type GuestEmailTemplateKey =
  | 'guest_complaint_update'
  | 'guest_request_update'
  | 'guest_receipt'
  | 'guest_complaint_message'
  | 'guest_stay_message'

interface GuestContact {
  email: string
  name: string
  hotelId: string
}

async function loadGuestContact(guestId: string): Promise<GuestContact | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guests')
    .select('email, name, hotel_id')
    .eq('id', guestId)
    .maybeSingle()

  const email = data?.email?.trim()
  if (!email || !data?.hotel_id) return null

  return {
    email,
    name: data.name ?? 'Guest',
    hotelId: data.hotel_id,
  }
}

/** Transactional guest email — not gated by staff notification prefs. */
export async function notifyGuestEmail(
  guestId: string,
  templateKey: GuestEmailTemplateKey,
  content: StaffEmailContent,
): Promise<void> {
  const contact = await loadGuestContact(guestId)
  if (!contact) return

  await sendToEmail(contact.email, content, {
    hotelId: contact.hotelId,
    templateKey,
  })
}

export async function notifyGuestComplaintEmail(
  guestId: string,
  input: { subject: string; preview: string; lines: string[] },
): Promise<void> {
  await notifyGuestEmail(guestId, 'guest_complaint_update', {
    subject: input.subject,
    preview: input.preview,
    lines: input.lines,
    actionUrl: appUrl('/guest'),
    actionLabel: 'Open guest portal',
  })
}

export async function notifyGuestRequestStatusEmail(
  guestId: string,
  input: { label: string; status: string; detail?: string },
): Promise<void> {
  const statusLabel =
    input.status === 'completed'
      ? 'approved'
      : input.status === 'declined'
        ? 'declined'
        : input.status === 'acknowledged'
          ? 'acknowledged'
          : input.status

  await notifyGuestEmail(guestId, 'guest_request_update', {
    subject: `${input.label} — ${statusLabel}`,
    preview: `Your ${input.label.toLowerCase()} request was ${statusLabel}.`,
    lines: [
      `Your ${input.label.toLowerCase()} request was ${statusLabel}.`,
      ...(input.detail ? [input.detail] : []),
    ],
    actionUrl: appUrl('/guest'),
    actionLabel: 'View portal',
  })
}

export async function emailGuestInvoiceReceipt(
  guestId: string,
  input: { invoiceNumber: string; totalAmount: number; paidAt: string | null },
): Promise<{ success: boolean; error?: string }> {
  const contact = await loadGuestContact(guestId)
  if (!contact) {
    return { success: false, error: 'No email on file. Add your email under You in the portal.' }
  }

  const amount = `GHS ${input.totalAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  await notifyGuestEmail(guestId, 'guest_receipt', {
    subject: `Receipt · ${input.invoiceNumber}`,
    preview: `Payment of ${amount} recorded for your stay.`,
    lines: [
      `Invoice: ${input.invoiceNumber}`,
      `Amount paid: ${amount}`,
      ...(input.paidAt
        ? [
            `Paid: ${new Date(input.paidAt).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}`,
          ]
        : []),
      'Thank you for staying with us.',
    ],
    actionUrl: appUrl('/guest'),
    actionLabel: 'Open guest portal',
  })

  return { success: true }
}
