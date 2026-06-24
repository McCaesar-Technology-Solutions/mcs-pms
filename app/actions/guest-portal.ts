'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findActiveGuestForRoom } from '@/lib/data/guest-room-access'
import {
  buildPropertyJoinUrl,
  ensureGuestPortalSlug,
  isValidGuestPortalSlug,
} from '@/lib/guest-portal'
import { setGuestSession } from '@/lib/guest-session'
import { hasAcceptedPropertyRules } from '@/lib/guest-rules-cookie'
import { getHotelGuestRules } from '@/lib/data/guest-rules'
import { guestRoomEntrySchema, submitComplaintSchema } from '@/lib/validations'
import { stayNights, tokenExpiryISO } from '@/lib/stays/helpers'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
import { guestNeedsRulesAcceptance } from '@/app/actions/guest-rules'
import { getGuestFromSession } from '@/app/actions/guest'
import {
  GUEST_COMPLAINT_PHOTO_BUCKET,
  guestComplaintPhotoMime,
  guestComplaintPhotoPath,
} from '@/lib/guest/complaint-photos'
import { notifyGuestRequestCreated } from '@/lib/notifications/guest-requests'
import { loadGuestPortalContext } from '@/lib/data/guest-portal'

export type GuestPortalActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export async function getPropertyJoinPage(slug: string): Promise<{ hotelName: string } | null> {
  if (!isValidGuestPortalSlug(slug)) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('name')
    .eq('guest_portal_slug', slug)
    .maybeSingle()

  if (!data) return null
  return { hotelName: data.name }
}

export async function enterGuestPortalByRoom(input: unknown): Promise<GuestPortalActionResult> {
  const parsed = guestRoomEntrySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry.' }
  }

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('id')
    .eq('guest_portal_slug', parsed.data.slug)
    .maybeSingle()

  if (!hotel) {
    return { success: false, error: 'This property link is not valid.' }
  }

  const rulesBundle = await getHotelGuestRules(hotel.id)
  if (!rulesBundle) {
    return { success: false, error: 'This property link is not valid.' }
  }

  const rulesAccepted = await hasAcceptedPropertyRules(hotel.id, rulesBundle.version)
  if (!rulesAccepted) {
    return {
      success: false,
      error: 'Please read and accept the property rules before continuing.',
    }
  }

  const match = await findActiveGuestForRoom(hotel.id, parsed.data.roomNumber)
  if (!match) {
    return {
      success: false,
      error:
        'No active stay found for that room. Double-check your room number or ask the front desk for help.',
    }
  }

  const expiresAt = match.guest.token_expires_at
    ? new Date(match.guest.token_expires_at)
    : match.guest.check_out
      ? new Date(tokenExpiryISO(match.guest.check_out))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await setGuestSession(match.guest.id, expiresAt)

  await admin
    .from('guests')
    .update({ guest_rules_accepted_version: rulesBundle.version })
    .eq('id', match.guest.id)

  redirect('/guest')
}

export async function getStaffPropertyPortalInfo(): Promise<
  GuestPortalActionResult<{ slug: string; joinUrl: string; hotelName: string }>
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('hotel_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const slug = await ensureGuestPortalSlug(profile.hotel_id)
  if (!slug) return { success: false, error: 'Could not load property portal link.' }

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('name')
    .eq('id', profile.hotel_id)
    .maybeSingle()

  const joinUrl = await buildPropertyJoinUrl(slug)

  return {
    success: true,
    data: {
      slug,
      joinUrl,
      hotelName: hotel?.name ?? 'Property',
    },
  }
}

async function requireGuestWithRules() {
  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return { ok: false as const, error: session.error ?? 'Not authorized.' }
  }
  if (await guestNeedsRulesAcceptance(session.data.guest.id)) {
    return { ok: false as const, error: 'Please accept the property rules to continue.' }
  }
  return { ok: true as const, guest: session.data.guest, roomNumber: session.data.roomNumber }
}

const guestRequestSchema = z.object({
  requestType: z.enum(['housekeeping', 'late_checkout', 'extension', 'self_checkout']),
  note: z.string().max(500).optional(),
})

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  complaintId: z.string().uuid().optional(),
})

const messageSchema = z.object({
  complaintId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

export async function fetchGuestPortalBundle() {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false as const, error: auth.error }
  const context = await loadGuestPortalContext(auth.guest)
  if (!context) return { success: false as const, error: 'Property not found.' }
  return {
    success: true as const,
    data: {
      context,
      guest: auth.guest,
      roomNumber: auth.roomNumber,
    },
  }
}

export async function submitGuestRequest(input: unknown): Promise<GuestPortalActionResult> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = guestRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('guest_requests')
    .insert({
      hotel_id: auth.guest.hotel_id,
      guest_id: auth.guest.id,
      room_id: auth.guest.room_id,
      request_type: parsed.data.requestType,
      note: parsed.data.note?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Could not submit your request.' }

  void notifyGuestRequestCreated(data.id)
  revalidatePath('/guest')
  return { success: true }
}

export async function setGuestDoNotDisturb(enabled: boolean): Promise<GuestPortalActionResult> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guests')
    .update({ do_not_disturb: enabled })
    .eq('id', auth.guest.id)

  if (error) return { success: false, error: 'Could not update Do Not Disturb.' }
  revalidatePath('/guest')
  return { success: true }
}

export async function submitGuestFeedback(input: unknown): Promise<GuestPortalActionResult> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid feedback.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('guest_feedback').insert({
    hotel_id: auth.guest.hotel_id,
    guest_id: auth.guest.id,
    complaint_id: parsed.data.complaintId ?? null,
    rating: parsed.data.rating,
    comment: parsed.data.comment?.trim() || null,
  })

  if (error) return { success: false, error: 'Could not save feedback.' }
  revalidatePath('/guest')
  return { success: true }
}

export async function getComplaintMessages(
  complaintId: string,
): Promise<
  GuestPortalActionResult<{
    messages: { id: string; authorRole: string; body: string; createdAt: string }[]
  }>
> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: complaint } = await admin
    .from('complaints')
    .select('id')
    .eq('id', complaintId)
    .eq('guest_id', auth.guest.id)
    .maybeSingle()

  if (!complaint) return { success: false, error: 'Issue not found.' }

  const { data } = await admin
    .from('complaint_messages')
    .select('id, author_role, body, created_at')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  return {
    success: true,
    data: {
      messages: (data ?? []).map((m) => ({
        id: m.id,
        authorRole: m.author_role,
        body: m.body,
        createdAt: m.created_at,
      })),
    },
  }
}

export async function postGuestComplaintMessage(input: unknown): Promise<GuestPortalActionResult> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = messageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const admin = createAdminClient()
  const { data: complaint } = await admin
    .from('complaints')
    .select('id')
    .eq('id', parsed.data.complaintId)
    .eq('guest_id', auth.guest.id)
    .maybeSingle()

  if (!complaint) return { success: false, error: 'Issue not found.' }

  const { error } = await admin.from('complaint_messages').insert({
    complaint_id: parsed.data.complaintId,
    author_role: 'guest',
    author_id: null,
    body: parsed.data.body.trim(),
  })

  if (error) return { success: false, error: 'Could not send message.' }

  void import('@/lib/notifications/complaints').then(({ notifyComplaintGuestMessage }) =>
    notifyComplaintGuestMessage(parsed.data.complaintId, parsed.data.body.trim()).catch(
      () => undefined,
    ),
  )

  return { success: true }
}

export async function submitGuestComplaintWithPhoto(
  formData: FormData,
): Promise<GuestPortalActionResult<{ reference: string }>> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = submitComplaintSchema.safeParse({
    category: formData.get('category'),
    description: formData.get('description'),
    priority: formData.get('priority') ?? 'medium',
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid submission.' }
  }

  const { submitGuestComplaint } = await import('@/app/actions/guest')
  const result = await submitGuestComplaint(parsed.data)
  if (!result.success || !result.data) {
    return result as GuestPortalActionResult<{ reference: string }>
  }

  const photo = formData.get('photo')
  if (!(photo instanceof File) || photo.size === 0) {
    return result
  }

  const mime = guestComplaintPhotoMime(photo)
  if (!mime) return { success: false, error: 'Photo must be JPEG, PNG, or WebP.' }
  if (photo.size > 5 * 1024 * 1024) return { success: false, error: 'Photo must be under 5 MB.' }

  const admin = createAdminClient()
  const { data: complaint } = await admin
    .from('complaints')
    .select('id')
    .eq('guest_id', auth.guest.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!complaint) return result

  const ext = mime.split('/')[1] ?? 'jpg'
  const path = guestComplaintPhotoPath(auth.guest.hotel_id, complaint.id, ext)
  const buffer = Buffer.from(await photo.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(GUEST_COMPLAINT_PHOTO_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true })

  if (uploadError) return result

  await admin
    .from('complaints')
    .update({ guest_photo_path: path, guest_photo_mime: mime })
    .eq('id', complaint.id)

  return result
}

export async function getGuestInvoiceReceiptData(
  invoiceId: string,
): Promise<
  GuestPortalActionResult<{
    invoiceNumber: string
    guestName: string
    totalAmount: number
    paymentStatus: string
    paidAt: string | null
  }>
> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data } = await admin
    .from('invoices')
    .select('invoice_number, guest_name, total_amount, payment_status, paid_at')
    .eq('id', invoiceId)
    .eq('guest_id', auth.guest.id)
    .maybeSingle()

  if (!data) return { success: false, error: 'Invoice not found.' }
  if (data.payment_status !== 'paid') {
    return { success: false, error: 'Receipt is available after payment is recorded.' }
  }

  return {
    success: true,
    data: {
      invoiceNumber: data.invoice_number ?? 'Invoice',
      guestName: data.guest_name,
      totalAmount: Number(data.total_amount),
      paymentStatus: data.payment_status ?? 'paid',
      paidAt: data.paid_at,
    },
  }
}

export async function getGuestComplaintPhotoUrl(
  complaintId: string,
): Promise<GuestPortalActionResult<{ url: string }>> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data } = await admin
    .from('complaints')
    .select('guest_photo_path')
    .eq('id', complaintId)
    .eq('guest_id', auth.guest.id)
    .maybeSingle()

  if (!data?.guest_photo_path) return { success: false, error: 'No photo for this issue.' }

  const { data: signed } = await admin.storage
    .from(GUEST_COMPLAINT_PHOTO_BUCKET)
    .createSignedUrl(data.guest_photo_path, 3600)

  if (!signed?.signedUrl) return { success: false, error: 'Could not load photo.' }
  return { success: true, data: { url: signed.signedUrl } }
}

export async function getGuestInvoiceReceiptExport(
  invoiceId: string,
): Promise<GuestPortalActionResult<{ hotel: ExportHotelInfo; invoice: InvoiceExportRow }>> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('invoices')
    .select(
      '*, hotels(name, address, city, region, vat_registration_number, vat_mode), reservations(check_in, check_out, rooms(number))',
    )
    .eq('id', invoiceId)
    .eq('guest_id', auth.guest.id)
    .maybeSingle()

  if (!row) return { success: false, error: 'Invoice not found.' }
  if (row.payment_status !== 'paid') {
    return { success: false, error: 'Receipt is available after payment is recorded.' }
  }

  const hotelRaw = row.hotels as {
    name: string
    address: string | null
    city: string | null
    region: string | null
    vat_registration_number: string | null
    vat_mode: 'exclusive' | 'inclusive' | null
  } | null

  const reservation = row.reservations as {
    check_in: string
    check_out: string
    rooms?: { number: string } | null
  } | null

  const checkIn = reservation?.check_in ?? auth.guest.check_in
  const checkOut = reservation?.check_out ?? auth.guest.check_out

  return {
    success: true,
    data: {
      hotel: {
        name: hotelRaw?.name ?? 'Property',
        address: hotelRaw?.address ?? null,
        city: hotelRaw?.city ?? null,
        region: hotelRaw?.region ?? null,
        vatRegistrationNumber: hotelRaw?.vat_registration_number ?? null,
        vatMode: hotelRaw?.vat_mode ?? 'exclusive',
      },
      invoice: {
        invoiceNumber: formatInvoiceNumber({ invoice_number: row.invoice_number, id: row.id }),
        guestName: row.guest_name,
        roomNumber: reservation?.rooms?.number ?? auth.roomNumber,
        checkIn: checkIn ?? null,
        checkOut: checkOut ?? null,
        nights: checkIn && checkOut ? stayNights(checkIn, checkOut) : null,
        issuedAt: row.issued_at,
        subtotal: Number(row.subtotal),
        nhil: Number(row.nhil_amount ?? 0),
        getfund: Number(row.getfund_amount ?? 0),
        covid: Number(row.covid_levy_amount ?? 0),
        vat: Number(row.vat_amount ?? 0),
        elevy: Number(row.elevy_amount ?? 0),
        total: Number(row.total_amount),
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
      },
    },
  }
}
