import type { ReservationActorRole, ReservationStatus } from '@/types'

export type TransitionSideEffect =
  | 'inventory'
  | 'hold-timer'
  | 'notifications'
  | 'folio'
  | 'room-status'
  | 'payment'
  | 'channel'

export interface TransitionDef {
  eventType: string
  requiredRole?: 'staff' | 'manager' | 'system'
  sideEffects: TransitionSideEffect[]
}

export const ALLOWED_TRANSITIONS: Partial<
  Record<ReservationStatus, Partial<Record<ReservationStatus, TransitionDef>>>
> = {
  inquiry: {
    provisional: {
      eventType: 'hold_requested',
      sideEffects: ['inventory', 'hold-timer'],
    },
    confirmed: {
      eventType: 'direct_confirmed',
      requiredRole: 'staff',
      sideEffects: ['inventory', 'notifications', 'payment', 'channel'],
    },
    cancelled: {
      eventType: 'cancellation_applied',
      sideEffects: ['inventory', 'notifications'],
    },
  },
  provisional: {
    confirmed: {
      eventType: 'deposit_received',
      requiredRole: 'staff',
      sideEffects: ['notifications', 'payment', 'channel'],
    },
    released: {
      eventType: 'hold_expired',
      sideEffects: ['inventory', 'hold-timer'],
    },
    cancelled: {
      eventType: 'hold_cancelled',
      sideEffects: ['inventory', 'hold-timer', 'notifications'],
    },
  },
  confirmed: {
    pre_arrival: {
      eventType: 'pre_arrival_triggered',
      requiredRole: 'system',
      sideEffects: ['notifications', 'channel'],
    },
    cancelled: {
      eventType: 'cancellation_applied',
      sideEffects: ['inventory', 'hold-timer', 'notifications', 'channel'],
    },
    checked_in: {
      eventType: 'checked_in',
      requiredRole: 'staff',
      sideEffects: ['folio', 'room-status', 'notifications'],
    },
    no_show: {
      eventType: 'marked_no_show',
      requiredRole: 'staff',
      sideEffects: ['inventory', 'payment', 'notifications'],
    },
  },
  pre_arrival: {
    checked_in: {
      eventType: 'checked_in',
      requiredRole: 'staff',
      sideEffects: ['folio', 'room-status', 'notifications'],
    },
    no_show: {
      eventType: 'marked_no_show',
      requiredRole: 'staff',
      sideEffects: ['inventory', 'payment', 'notifications'],
    },
    cancelled: {
      eventType: 'cancellation_applied',
      sideEffects: ['inventory', 'hold-timer', 'notifications', 'channel'],
    },
  },
  checked_in: {
    checkout_in_progress: {
      eventType: 'checkout_initiated',
      sideEffects: ['folio', 'room-status'],
    },
    overstay: {
      eventType: 'overstay_detected',
      requiredRole: 'system',
      sideEffects: ['room-status', 'notifications', 'folio'],
    },
    walkout: {
      eventType: 'walkout_detected',
      requiredRole: 'staff',
      sideEffects: ['inventory', 'room-status', 'folio'],
    },
  },
  overstay: {
    checkout_in_progress: {
      eventType: 'checkout_initiated',
      requiredRole: 'staff',
      sideEffects: ['folio', 'room-status'],
    },
    walkout: {
      eventType: 'walkout_detected',
      requiredRole: 'staff',
      sideEffects: ['inventory', 'room-status', 'folio'],
    },
  },
  checkout_in_progress: {
    checked_out: {
      eventType: 'checkout_completed',
      sideEffects: ['inventory', 'room-status', 'channel'],
    },
    walkout: {
      eventType: 'walkout_detected',
      requiredRole: 'staff',
      sideEffects: ['inventory', 'room-status', 'folio'],
    },
  },
  checked_out: {
    post_stay: {
      eventType: 'post_stay_started',
      requiredRole: 'system',
      sideEffects: [],
    },
  },
  post_stay: {
    archived: {
      eventType: 'archived',
      requiredRole: 'system',
      sideEffects: [],
    },
  },
}

export function getTransitionDef(
  from: ReservationStatus,
  to: ReservationStatus,
): TransitionDef | null {
  return ALLOWED_TRANSITIONS[from]?.[to] ?? null
}

/** Map profile / caller role to lifecycle actor role. */
export function normalizeActorRole(
  role: string | undefined,
): ReservationActorRole | undefined {
  if (!role) return undefined
  if (role === 'system') return 'system'
  if (role === 'guest') return 'guest'
  if (role === 'manager' || role === 'owner') return 'manager'
  if (role === 'receptionist' || role === 'staff') return 'staff'
  if (role === 'backfill') return 'system'
  return 'staff'
}

export function actorMeetsRequiredRole(
  actorRole: ReservationActorRole | undefined,
  required: TransitionDef['requiredRole'],
  bypassRoleCheck?: boolean,
): boolean {
  if (bypassRoleCheck) return true
  if (!required) return true
  if (!actorRole) return false
  if (required === 'system') return actorRole === 'system'
  if (required === 'manager') return actorRole === 'manager' || actorRole === 'system'
  if (required === 'staff') {
    return actorRole === 'staff' || actorRole === 'manager' || actorRole === 'system'
  }
  return false
}
