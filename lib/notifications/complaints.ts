import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPhones } from '@/lib/notifications/send'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { appUrl } from '@/lib/notifications/app-url'
import { smsLine, smsRoom, smsTruncate, smsUrl } from '@/lib/notifications/sms-format'
import { formatComplaintVisit } from '@/lib/complaints/visit'
import { technicianPhone } from '@/lib/notifications/recipients'
import { notifyManagers } from '@/lib/notifications/manager-notify'
import { managerComplaintChatUrl } from '@/lib/complaints/urls'
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
  guestId?: string | null
  guestName?: string | null
  guestPhone?: string | null
  assignedTo?: string | null
}

async function loadComplaintContext(complaintId: string): Promise<ComplaintNotifyContext | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('complaints')
    .select('id, hotel_id, category, priority, description, assigned_to, guest_id, rooms(number), guests(name, phone)')
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
    guestId: data.guest_id ?? null,
    guestName: guest?.name ?? null,
    guestPhone: guest?.phone ?? null,
    assignedTo: data.assigned_to ?? null,
  }
}

function refLine(ctx: ComplaintNotifyContext): string {
  const cat = CATEGORY_LABELS[ctx.category] ?? ctx.category
  return `${smsRoom(ctx.roomNumber)}, ${cat}`
}

/** Guest filed a new complaint — alert front desk / manager. */
export async function notifyComplaintSubmitted(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const ref = complaintId.slice(0, 8).toUpperCase()
  const urgent = ctx.priority === 'urgent' ? ' [URGENT]' : ''
  const guest = ctx.guestName ? `${ctx.guestName}: ` : ''
  const dashboardUrl = appUrl('/manager/complaints')
  const body = smsLine(
    'MOJO:',
    `Complaint${urgent}`,
    refLine(ctx),
    smsTruncate(`${guest}${ctx.description}`, 80),
    `Ref ${ref}.`,
    smsUrl('/manager/complaints'),
  )

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
  const body = smsLine(
    'MOJO:',
    'Complaint received',
    refLine(ctx),
    `Ref ${ref}.`,
    smsUrl('/guest'),
  )

  await notifyPhones([ctx.guestPhone], body, phoneNotifyOpts('complaint_guest_received', { hotelId: ctx.hotelId }))

  if (ctx.guestId) {
    const { notifyGuestComplaintEmail } = await import('@/lib/notifications/guest-email')
    void notifyGuestComplaintEmail(ctx.guestId, {
      subject: `Issue received · ${refLine(ctx)}`,
      preview: 'We received your maintenance report.',
      lines: [refLine(ctx), `Reference: ${ref}`, 'Our team will follow up shortly.'],
    })
  }
}

/** Manager assigned a job — alert technician. */
export async function notifyComplaintAssigned(
  complaintId: string,
  technicianId: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  const phone = await technicianPhone(technicianId)
  if (!ctx || !phone) return

  const body = smsLine(
    'MOJO:',
    'New job',
    refLine(ctx),
    smsTruncate(ctx.description, 80),
    smsUrl('/technician/tasks'),
  )

  await notifyPhones([phone], body, phoneNotifyOpts('complaint_assigned', { hotelId: ctx.hotelId }))
}

/** Technician marked job complete — alert manager and guest (when linked). */
export async function notifyComplaintCompletionRequested(complaintId: string): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const dashboardUrl = appUrl('/manager/complaints')
  const body = smsLine(
    'MOJO:',
    'Job ready for approval',
    refLine(ctx),
    smsUrl('/manager/complaints'),
  )

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
    const body = smsLine(
      'MOJO:',
      'Work complete',
      refLine(ctx),
      'Confirm in portal:',
      smsUrl('/guest'),
    )

    await notifyPhones([ctx.guestPhone], body, phoneNotifyOpts('complaint_guest_signoff', { hotelId: ctx.hotelId }))
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
    const body = smsLine(
      'MOJO:',
      'Visit confirmed',
      refLine(ctx),
      when ?? '',
      smsUrl('/guest'),
    )

    await notifyPhones([ctx.guestPhone], body, phoneNotifyOpts('complaint_visit_scheduled', { hotelId: ctx.hotelId }))
  }

  if (ctx.guestId) {
    const { notifyGuestComplaintEmail } = await import('@/lib/notifications/guest-email')
    void notifyGuestComplaintEmail(ctx.guestId, {
      subject: `Visit confirmed · ${refLine(ctx)}`,
      preview: when ? `Maintenance visit scheduled for ${when}.` : 'A maintenance visit was scheduled.',
      lines: [refLine(ctx), appointment, 'Your technician agreed this time with you.'],
    })
  }

  const dashboardUrl = appUrl('/manager/complaints')
  const body = smsLine(
    'MOJO:',
    'Visit scheduled',
    refLine(ctx),
    when ?? '',
    smsUrl('/manager/complaints'),
  )

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
  const body = smsLine(
    'MOJO:',
    'Guest sign-off',
    refLine(ctx),
    smsUrl('/manager/complaints'),
  )

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
  const body = smsLine(
    'MOJO:',
    `Invoice${tech}`,
    refLine(ctx),
    `GHS ${total}.`,
    smsUrl('/manager/complaints'),
  )

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

  const body = smsLine(
    'MOJO:',
    'Invoice approved',
    refLine(ctx),
    smsUrl('/technician/tasks'),
  )

  await notifyPhones([phone], body, phoneNotifyOpts('complaint_estimate_approved', { hotelId: ctx.hotelId }))
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

  const body = smsLine(
    'MOJO:',
    'Job sent back',
    refLine(ctx),
    smsTruncate(rejectionNote, 80),
    smsUrl('/technician/tasks'),
  )

  await notifyPhones([phone], body, phoneNotifyOpts('complaint_rejected', { hotelId: ctx.hotelId }))
}

/** Guest replied on a complaint thread — alert managers. */
export async function notifyComplaintGuestMessage(
  complaintId: string,
  messagePreview: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const preview = messagePreview.slice(0, 120)
  const chatUrl = managerComplaintChatUrl(complaintId)
  const guestLabel = ctx.guestName ? `${ctx.guestName}: ` : ''

  await notifyManagers({
    hotelId: ctx.hotelId,
    templateKey: 'complaint_guest_message',
    smsBody: smsLine(
      'MOJO:',
      'Guest message',
      refLine(ctx),
      smsTruncate(`${guestLabel}${preview}`, 80),
      smsUrl('/manager/complaints'),
    ),
    email: {
      subject: `Guest message — ${refLine(ctx)}`,
      preview: `${ctx.guestName ?? 'A guest'} sent a message in the guest portal.`,
      lines: [
        ...(ctx.guestName ? [`From: ${ctx.guestName}`] : []),
        refLine(ctx),
        `"${preview}"`,
      ],
      actionUrl: chatUrl,
      actionLabel: 'Open chat',
    },
  })
}

/** Staff or technician replied — alert guest via SMS and email. */
export async function notifyComplaintStaffMessageToGuest(
  complaintId: string,
  messagePreview: string,
): Promise<void> {
  const ctx = await loadComplaintContext(complaintId)
  if (!ctx) return

  const preview = messagePreview.slice(0, 120)
  const smsBody = smsLine(
    'MOJO:',
    'Team message',
    refLine(ctx),
    smsTruncate(preview, 80),
    smsUrl('/guest'),
  )

  if (ctx.guestPhone) {
    await notifyPhones([ctx.guestPhone], smsBody, phoneNotifyOpts('complaint_guest_message', { hotelId: ctx.hotelId }))
  }

  if (ctx.guestId) {
    const { notifyGuestEmail } = await import('@/lib/notifications/guest-email')
    void notifyGuestEmail(ctx.guestId, 'guest_complaint_message', {
      subject: `Message from staff · ${refLine(ctx)}`,
      preview,
      lines: [refLine(ctx), `"${preview}"`],
      actionUrl: appUrl('/guest'),
      actionLabel: 'Reply in portal',
    })
  }
}
