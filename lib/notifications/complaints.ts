import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPhones } from '@/lib/notifications/send'
import { appUrl } from '@/lib/notifications/app-url'
import { formatComplaintVisit } from '@/lib/complaints/visit'
import { technicianPhone } from '@/lib/notifications/recipients'
import { notifyManagers } from '@/lib/notifications/manager-notify'
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

interface ComplaintNotifyContext {
  hotelId: string
  complaintId: string
  category: ComplaintCategory
  roomNumber: string | null
  priority: string | null
  description: string
  guestName?: string | null
  guestPhone?: string | null
  assignedTo?: string | null
}

async function loadComplaintContext(complaintId: string): Promise<ComplaintNotifyContext | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('complaints')
    .select('id, hotel_id, category, priority, description, assigned_to, rooms(number), guests(name, phone)')
    .eq('id', complaintId)
    .maybeSingle()

  if (!data) return null

  const room = data.rooms as { number?: string } | null
  const guest = data.guests as { name?: string; phone?: string | null } | null

  return {
    hotelId: data.hotel_id,
    complaintId: data.id,
    category: data.category as ComplaintCategory,
    roomNumber: room?.number ?? null,
    priority: data.priority,
    description: data.description,
    guestName: guest?.name ?? null,
    guestPhone: guest?.phone ?? null,
    assignedTo: data.assigned_to ?? null,
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

  const ref = complaintId.slice(0, 8).toUpperCase()
  const urgent = ctx.priority === 'urgent' ? ' [URGENT]' : ''
  const guest = ctx.guestName ? `${ctx.guestName}: ` : ''
  const dashboardUrl = appUrl('/manager/complaints')
  const body = [
    `MOJO: New guest complaint${urgent}`,
    refLine(ctx),
    `${guest}${ctx.description.slice(0, 120)}`,
    `Ref ${ref}`,
    dashboardUrl,
  ].join('\n')

  await notifyManagers({
    hotelId: ctx.hotelId,
    templateKey: 'complaint_submitted',
    smsBody: body,
    email: {
      subject: urgent ? `Urgent complaint · ${refLine(ctx)}` : `New guest complaint · ${refLine(ctx)}`,
      preview: 'A guest reported an issue that needs attention.',
      lines: [
        refLine(ctx),
        `${guest}${ctx.description.slice(0, 200)}`,
        `Reference: ${ref}`,
      ],
      actionUrl: dashboardUrl,
      actionLabel: 'View complaints',
    },
  })
}

/** Guest filed a complaint — confirmation SMS with reference. */
export async function notifyGuestComplaintReceived(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx?.guestPhone) return

  const ref = complaintId.slice(0, 8).toUpperCase()
  const body = [
    'MOJO: Complaint received',
    refLine(ctx),
    `Ref ${ref}. Our team will follow up shortly.`,
    appUrl('/guest'),
  ].join('\n')

  await notifyPhones([ctx.guestPhone], body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_guest_received',
    includeWhatsApp: false,
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
    includeWhatsApp: false,
  })
}

/** Technician marked job complete — alert manager and guest (when linked). */
export async function notifyComplaintCompletionRequested(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const dashboardUrl = appUrl('/manager/complaints')
  const body = [
    'MOJO: Job ready for approval',
    refLine(ctx),
    'Technician marked work complete. Review in the dashboard.',
    dashboardUrl,
  ].join('\n')

  await notifyManagers({
    hotelId: ctx.hotelId,
    templateKey: 'complaint_completion_requested',
    smsBody: body,
    email: {
      subject: `Job ready for approval · ${refLine(ctx)}`,
      preview: 'A technician marked maintenance work as complete.',
      lines: [refLine(ctx), 'Review and approve in the dashboard.'],
      actionUrl: dashboardUrl,
      actionLabel: 'Review job',
    },
  })

  if (ctx.guestPhone) {
    const body = [
      'MOJO: Maintenance update',
      refLine(ctx),
      'Work is complete. Please confirm in your guest portal.',
      appUrl('/guest'),
    ].join('\n')

    await notifyPhones([ctx.guestPhone], body, {
      hotelId: ctx.hotelId,
      templateKey: 'complaint_guest_signoff',
      includeWhatsApp: false,
    })
  }
}

/** Visit time agreed with guest — alert guest and front desk. */
export async function notifyComplaintVisitScheduled(
  complaintId: string,
  visitAtIso: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const when = formatComplaintVisit(visitAtIso)
  const appointment = when ? `Appointment: ${when}` : 'A visit time was set.'

  if (ctx.guestPhone) {
    const body = [
      'MOJO: Maintenance visit confirmed',
      refLine(ctx),
      appointment,
      'Your technician agreed this time with you.',
      appUrl('/guest'),
    ].join('\n')

    await notifyPhones([ctx.guestPhone], body, {
      hotelId: ctx.hotelId,
      templateKey: 'complaint_visit_scheduled',
      includeWhatsApp: false,
    })
  }

  const dashboardUrl = appUrl('/manager/complaints')
  const body = [
    'MOJO: Maintenance visit scheduled',
    refLine(ctx),
    appointment,
    dashboardUrl,
  ].join('\n')

  await notifyManagers({
    hotelId: ctx.hotelId,
    templateKey: 'complaint_visit_scheduled',
    smsBody: body,
    email: {
      subject: `Visit scheduled · ${refLine(ctx)}`,
      preview: 'A maintenance visit was scheduled with the guest.',
      lines: [refLine(ctx), appointment],
      actionUrl: dashboardUrl,
      actionLabel: 'View complaint',
    },
  })
}

/** Guest confirmed work is complete — alert manager. */
export async function notifyGuestApprovedCompletion(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const guest = ctx.guestName ? `${ctx.guestName} confirmed` : 'Guest confirmed'
  const dashboardUrl = appUrl('/manager/complaints')
  const body = [
    'MOJO: Guest sign-off received',
    refLine(ctx),
    `${guest} the work is complete. Complaint resolved.`,
    dashboardUrl,
  ].join('\n')

  await notifyManagers({
    hotelId: ctx.hotelId,
    templateKey: 'complaint_guest_approved',
    smsBody: body,
    email: {
      subject: `Guest sign-off · ${refLine(ctx)}`,
      preview: 'The guest confirmed maintenance work is complete.',
      lines: [refLine(ctx), `${guest} the work is complete.`],
      actionUrl: dashboardUrl,
      actionLabel: 'View complaint',
    },
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

  const tech = technicianName ? ` from ${technicianName}` : ''
  const total = totalCost.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const dashboardUrl = appUrl('/manager/complaints')
  const body = [
    `MOJO: Technician invoice${tech}`,
    refLine(ctx),
    `Total: GHS ${total}`,
    'Awaiting your approval to start work.',
    dashboardUrl,
  ].join('\n')

  await notifyManagers({
    hotelId: ctx.hotelId,
    templateKey: 'complaint_invoice_submitted',
    smsBody: body,
    email: {
      subject: `Technician invoice · ${refLine(ctx)}`,
      preview: 'A technician submitted an invoice for your approval.',
      lines: [
        refLine(ctx),
        technicianName ? `Technician: ${technicianName}` : 'Technician invoice submitted',
        `Total: GHS ${total}`,
        'Awaiting your approval to start work.',
      ],
      actionUrl: dashboardUrl,
      actionLabel: 'Review invoice',
    },
  })
}

/** Manager approved invoice — technician may start the job. */
export async function notifyComplaintEstimateApproved(
  complaintId: string,
  technicianId: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  const phone = await technicianPhone(technicianId)
  if (!ctx || !phone) return

  const body = [
    'MOJO: Invoice approved',
    refLine(ctx),
    'You can now start the job.',
    appUrl('/technician/tasks'),
  ].join('\n')

  await notifyPhones([phone], body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_estimate_approved',
    includeWhatsApp: false,
  })
}

/** Manager sent job back — alert technician with note. */
export async function notifyComplaintRejected(
  complaintId: string,
  rejectionNote: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx?.assignedTo) return

  const phone = await technicianPhone(ctx.assignedTo)
  if (!phone) return

  const body = [
    'MOJO: Job sent back',
    refLine(ctx),
    rejectionNote.slice(0, 160),
    appUrl('/technician/tasks'),
  ].join('\n')

  await notifyPhones([phone], body, {
    hotelId: ctx.hotelId,
    templateKey: 'complaint_rejected',
    includeWhatsApp: false,
  })
}
