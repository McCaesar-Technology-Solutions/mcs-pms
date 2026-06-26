/** Email alerts for owners and managers — subset of operational events. */
export const EMAIL_STAFF_TEMPLATE_KEYS = [
  'reservation_new_manager',
  'complaint_submitted',
  'complaint_completion_requested',
  'complaint_guest_approved',
  'complaint_invoice_submitted',
  'complaint_visit_scheduled',
  'complaint_guest_message',
  'guest_stay_chat',
  'guest_request',
  'guest_feedback',
  'guest_feedback_low',
  'staff_invite',
  'room_created',
] as const

export type EmailStaffTemplateKey = (typeof EMAIL_STAFF_TEMPLATE_KEYS)[number]

export type NotificationEmailPrefs = Partial<Record<EmailStaffTemplateKey, boolean>>

export const EMAIL_PREF_GROUPS: {
  title: string
  description: string
  keys: EmailStaffTemplateKey[]
}[] = [
  {
    title: 'Reservations',
    description: 'Booking alerts for your team inbox.',
    keys: ['reservation_new_manager'],
  },
  {
    title: 'Complaints & maintenance',
    description: 'Guest issues, sign-off, and technician invoices.',
    keys: [
      'complaint_submitted',
      'complaint_completion_requested',
      'complaint_guest_approved',
      'complaint_invoice_submitted',
      'complaint_visit_scheduled',
      'complaint_guest_message',
    ],
  },
  {
    title: 'Guest portal',
    description: 'Requests and reviews from the in-room guest app.',
    keys: ['guest_request', 'guest_feedback', 'guest_feedback_low', 'guest_stay_chat'],
  },
  {
    title: 'Staff',
    description: 'Invite emails for managers and receptionists.',
    keys: ['staff_invite'],
  },
  {
    title: 'Rooms & inventory',
    description: 'When managers add rooms to your property.',
    keys: ['room_created'],
  },
]

export const EMAIL_PREF_LABELS: Record<EmailStaffTemplateKey, string> = {
  reservation_new_manager: 'New booking alert',
  complaint_submitted: 'New guest complaint',
  complaint_completion_requested: 'Job ready for approval',
  complaint_guest_approved: 'Guest sign-off received',
  complaint_invoice_submitted: 'Technician invoice submitted',
  complaint_visit_scheduled: 'Maintenance visit scheduled',
  complaint_guest_message: 'Guest chat message',
  guest_stay_chat: 'Stay chat message',
  guest_request: 'Guest portal request',
  guest_feedback: 'Guest review submitted',
  guest_feedback_low: 'Low guest review (≤2 stars)',
  staff_invite: 'Staff invite email (manager / receptionist)',
  room_created: 'New room added by manager',
}

/** Staff invite emails always send — onboarding must not be blocked by prefs. */
export const EMAIL_ALWAYS_SEND = new Set<EmailStaffTemplateKey>(['staff_invite'])

/** Transactional guest emails — always send when Resend is configured. */
export const GUEST_EMAIL_TEMPLATE_KEYS = [
  'guest_complaint_update',
  'guest_request_update',
  'guest_receipt',
  'guest_complaint_message',
] as const

export type GuestEmailTemplateKey = (typeof GUEST_EMAIL_TEMPLATE_KEYS)[number]

export function defaultNotificationEmailPrefs(): Record<EmailStaffTemplateKey, boolean> {
  return Object.fromEntries(
    EMAIL_STAFF_TEMPLATE_KEYS.map((k) => [k, true]),
  ) as Record<EmailStaffTemplateKey, boolean>
}

export function mergeEmailPrefs(
  stored: NotificationEmailPrefs | null | undefined,
): Record<EmailStaffTemplateKey, boolean> {
  const base = defaultNotificationEmailPrefs()
  if (!stored || typeof stored !== 'object') return base
  for (const key of EMAIL_STAFF_TEMPLATE_KEYS) {
    if (typeof stored[key] === 'boolean') base[key] = stored[key]!
  }
  return base
}

export function isEmailTemplateEnabled(
  prefs: Record<EmailStaffTemplateKey, boolean>,
  templateKey: string,
): boolean {
  if (EMAIL_ALWAYS_SEND.has(templateKey as EmailStaffTemplateKey)) return true
  if (!(EMAIL_STAFF_TEMPLATE_KEYS as readonly string[]).includes(templateKey)) return false
  return prefs[templateKey as EmailStaffTemplateKey] !== false
}
