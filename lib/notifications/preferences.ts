/** SMS template keys — must match `templateKey` passed to notifyPhones / sendToPhone. */
export const NOTIFICATION_TEMPLATE_KEYS = [
  'reservation_new_manager',
  'reservation_confirmed',
  'reservation_cancelled',
  'guest_checked_in',
  'guest_checked_out',
  'complaint_submitted',
  'complaint_guest_received',
  'complaint_assigned',
  'complaint_completion_requested',
  'complaint_guest_signoff',
  'complaint_visit_scheduled',
  'complaint_guest_approved',
  'complaint_invoice_submitted',
  'complaint_estimate_approved',
  'complaint_rejected',
  'complaint_guest_message',
  'guest_request',
  'room_created',
  'housekeeping_assigned',
  'staff_invite',
] as const

export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number]

export type NotificationSmsPrefs = Partial<Record<NotificationTemplateKey, boolean>>

export const NOTIFICATION_PREF_GROUPS: {
  title: string
  description: string
  keys: NotificationTemplateKey[]
}[] = [
  {
    title: 'Reservations & stays',
    description: 'Bookings, check-in, and check-out messages.',
    keys: [
      'reservation_new_manager',
      'reservation_confirmed',
      'reservation_cancelled',
      'guest_checked_in',
      'guest_checked_out',
    ],
  },
  {
    title: 'Complaints & maintenance',
    description: 'Guest complaints, technician jobs, and sign-off.',
    keys: [
      'complaint_submitted',
      'complaint_guest_received',
      'complaint_assigned',
      'complaint_completion_requested',
      'complaint_guest_signoff',
      'complaint_visit_scheduled',
      'complaint_guest_approved',
      'complaint_invoice_submitted',
      'complaint_estimate_approved',
      'complaint_rejected',
      'complaint_guest_message',
    ],
  },
  {
    title: 'Guest portal',
    description: 'Requests from the in-room guest app.',
    keys: ['guest_request'],
  },
  {
    title: 'Rooms & inventory',
    description: 'When managers add rooms to your property.',
    keys: ['room_created'],
  },
  {
    title: 'Housekeeping & staff',
    description: 'Task assignments and team invites.',
    keys: ['housekeeping_assigned', 'staff_invite'],
  },
]

export const NOTIFICATION_PREF_LABELS: Record<NotificationTemplateKey, string> = {
  reservation_new_manager: 'New booking alert (managers)',
  reservation_confirmed: 'Booking confirmation (guest)',
  reservation_cancelled: 'Cancellation notice (guest)',
  guest_checked_in: 'Check-in portal link (guest)',
  guest_checked_out: 'Check-out thank-you (guest)',
  complaint_submitted: 'New complaint (managers)',
  complaint_guest_received: 'Complaint received (guest)',
  complaint_assigned: 'Job assigned (technician)',
  complaint_completion_requested: 'Work complete — manager / guest sign-off',
  complaint_guest_signoff: 'Guest sign-off prompt',
  complaint_visit_scheduled: 'Visit scheduled (guest & managers)',
  complaint_guest_approved: 'Guest approved work (managers)',
  complaint_invoice_submitted: 'Technician invoice submitted (managers)',
  complaint_estimate_approved: 'Invoice approved (technician)',
  complaint_rejected: 'Job sent back (technician)',
  complaint_guest_message: 'Guest portal chat message (managers)',
  guest_request: 'Guest portal request (managers)',
  room_created: 'New room added (owner)',
  housekeeping_assigned: 'Housekeeping task assigned',
  staff_invite: 'Staff invite link (technician SMS)',
}

/** Keys that bypass property prefs (security / auth). */
export const NOTIFICATION_ALWAYS_SEND = new Set(['mfa_otp', 'staff_invite'])

export function defaultNotificationSmsPrefs(): Record<NotificationTemplateKey, boolean> {
  return Object.fromEntries(
    NOTIFICATION_TEMPLATE_KEYS.map((k) => [k, true]),
  ) as Record<NotificationTemplateKey, boolean>
}

export function mergeNotificationPrefs(
  stored: NotificationSmsPrefs | null | undefined,
): Record<NotificationTemplateKey, boolean> {
  const base = defaultNotificationSmsPrefs()
  if (!stored || typeof stored !== 'object') return base
  for (const key of NOTIFICATION_TEMPLATE_KEYS) {
    if (typeof stored[key] === 'boolean') base[key] = stored[key]!
  }
  return base
}

export function isTemplateEnabled(
  prefs: Record<NotificationTemplateKey, boolean>,
  templateKey: string,
): boolean {
  if (NOTIFICATION_ALWAYS_SEND.has(templateKey)) return true
  if (!(NOTIFICATION_TEMPLATE_KEYS as readonly string[]).includes(templateKey)) return true
  return prefs[templateKey as NotificationTemplateKey] !== false
}
