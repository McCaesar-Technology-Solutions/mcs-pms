import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPhones } from '@/lib/notifications/send'
import type { ComplaintCategory } from '@/types'

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  furniture: 'Furniture',
  cleaning: 'Cleaning',
  noise: 'Noise',
  other: 'Other',
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path}`
}

async function managerPhones(hotelId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('phone, role')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('role', ['manager', 'owner'])
    .not('phone', 'is', null)

  const managers = (data ?? []).filter((p) => p.role === 'manager' && p.phone)
  const phones = managers.map((p) => p.phone!)
  if (phones.length > 0) return phones

  return (data ?? [])
    .filter((p) => p.role === 'owner' && p.phone)
    .map((p) => p.phone!)
}

async function technicianPhone(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle()
  return data?.phone ?? null
}

interface ComplaintNotifyContext {
  hotelId: string
  complaintId: string
  category: ComplaintCategory
  roomNumber: string | null
  priority: string | null
  description: string
  guestName?: string | null
}

async function loadComplaintContext(complaintId: string): Promise<ComplaintNotifyContext | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('complaints')
    .select('id, hotel_id, category, priority, description, rooms(number), guests(name)')
    .eq('id', complaintId)
    .maybeSingle()

  if (!data) return null

  const room = data.rooms as { number?: string } | null
  const guest = data.guests as { name?: string } | null

  return {
    hotelId: data.hotel_id,
    complaintId: data.id,
    category: data.category as ComplaintCategory,
    roomNumber: room?.number ?? null,
    priority: data.priority,
    description: data.description,
    guestName: guest?.name ?? null,
  }
}

function refLine(ctx: ComplaintNotifyContext): string {
  const cat = CATEGORY_LABELS[ctx.category] ?? ctx.category
  const room = ctx.roomNumber ? `Room ${ctx.roomNumber}` : 'Room —'
  return `${room} · ${cat}`
}

/** Guest filed a new complaint — alert front desk / manager. */
export async function notifyComplaintSubmitted(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const phones = await managerPhones(ctx.hotelId)
  if (phones.length === 0) return

  const ref = complaintId.slice(0, 8).toUpperCase()
  const urgent = ctx.priority === 'urgent' ? ' [URGENT]' : ''
  const guest = ctx.guestName ? `${ctx.guestName}: ` : ''
  const body = [
    `MOJO: New guest complaint${urgent}`,
    refLine(ctx),
    `${guest}${ctx.description.slice(0, 120)}`,
    `Ref ${ref}`,
    appUrl('/manager/complaints'),
  ].join('\n')

  await notifyPhones(phones, body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_submitted',
    includeWhatsApp: true,
  })
}

/** Manager assigned a job — alert technician. */
export async function notifyComplaintAssigned(
  complaintId: string,
  technicianId: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  const phone = await technicianPhone(technicianId)
  if (!ctx || !phone) return

  const body = [
    'MOJO: New maintenance assignment',
    refLine(ctx),
    ctx.description.slice(0, 140),
    appUrl('/technician/tasks'),
  ].join('\n')

  await notifyPhones([phone], body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_assigned',
    includeWhatsApp: true,
  })
}

/** Technician marked job complete — alert manager. */
export async function notifyComplaintCompletionRequested(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const phones = await managerPhones(ctx.hotelId)
  if (phones.length === 0) return

  const body = [
    'MOJO: Job ready for approval',
    refLine(ctx),
    'Technician marked work complete. Review in the dashboard.',
    appUrl('/manager/complaints'),
  ].join('\n')

  await notifyPhones(phones, body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_completion_requested',
    includeWhatsApp: true,
  })
}

/** Technician submitted cost invoice — alert manager with totals. */
export async function notifyComplaintInvoiceSubmitted(
  complaintId: string,
  totalCost: number,
  technicianName?: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const phones = await managerPhones(ctx.hotelId)
  if (phones.length === 0) return

  const tech = technicianName ? ` from ${technicianName}` : ''
  const body = [
    `MOJO: Technician invoice${tech}`,
    refLine(ctx),
    `Total: GHS ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'Awaiting your approval.',
    appUrl('/manager/complaints'),
  ].join('\n')

  await notifyPhones(phones, body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_invoice_submitted',
    includeWhatsApp: true,
  })
}
