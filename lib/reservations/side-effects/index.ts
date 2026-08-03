import type { createAdminClient } from '@/lib/supabase/admin'
import type { ReservationStatus } from '@/types'
import type { TransitionSideEffect } from '@/lib/reservations/transitions'
import { runNotifyTask } from '@/lib/notifications/notify-task'

type AdminClient = ReturnType<typeof createAdminClient>

export interface ReservationRow {
  id: string
  hotel_id: string
  room_id: string | null
  guest_id: string | null
  guest_name: string
  status: string | null
  check_in: string
  check_out: string
  channel: string | null
  amount_paid: number | null
  total_amount: number | null
  nightly_rate?: number | null
  monthly_rate?: number | null
  rate_type?: string | null
  folio_locked?: boolean
}

export interface SideEffectContext {
  admin: AdminClient
  reservation: ReservationRow
  fromStatus: ReservationStatus
  toStatus: ReservationStatus
  eventType: string
  payload?: Record<string, unknown>
  actorId?: string
  actorRole?: string
}

export async function runInventorySideEffect(ctx: SideEffectContext): Promise<void> {
  void ctx
  // Occupancy is derived from reservation status via lifecycle helpers.
}

export async function runHoldTimerSideEffect(ctx: SideEffectContext): Promise<{
  holdSource?: 'online' | 'phone' | 'agent'
  holdMinutes?: number
}> {
  if (ctx.toStatus !== 'provisional') return {}

  const holdSource =
    (ctx.payload?.holdSource as 'online' | 'phone' | 'agent' | undefined) ??
    (ctx.reservation.channel === 'direct' ? 'phone' : 'online')

  const { data: hotel } = await ctx.admin
    .from('hotels')
    .select(
      'hold_duration_online_minutes, hold_duration_phone_minutes, hold_duration_agent_minutes',
    )
    .eq('id', ctx.reservation.hotel_id)
    .maybeSingle()

  const minutes =
    holdSource === 'agent'
      ? (hotel?.hold_duration_agent_minutes ?? 1440)
      : holdSource === 'phone'
        ? (hotel?.hold_duration_phone_minutes ?? 240)
        : (hotel?.hold_duration_online_minutes ?? 15)

  return { holdSource, holdMinutes: minutes }
}

export async function runNotificationsSideEffect(ctx: SideEffectContext): Promise<void> {
  const { notifyGuestReservationConfirmed, notifyGuestCheckedIn } = await import(
    '@/lib/notifications/stays'
  )

  if (ctx.toStatus === 'confirmed' && ctx.payload?.guestPhone) {
    const phone = String(ctx.payload.guestPhone)
    const roomNumber = ctx.payload.roomNumber ? String(ctx.payload.roomNumber) : null
    runNotifyTask(
      notifyGuestReservationConfirmed({
        hotelId: ctx.reservation.hotel_id,
        phone,
        guestName: ctx.reservation.guest_name,
        roomNumber,
        checkIn: ctx.reservation.check_in,
        checkOut: ctx.reservation.check_out,
      }),
      {
        templateKey: 'reservation_confirmed',
        hotelId: ctx.reservation.hotel_id,
        channel: 'sms',
      },
    )
  }

  if (ctx.toStatus === 'checked_in' && ctx.payload?.guestPhone && ctx.payload?.portalToken) {
    runNotifyTask(
      notifyGuestCheckedIn({
        hotelId: ctx.reservation.hotel_id,
        phone: String(ctx.payload.guestPhone),
        guestName: ctx.reservation.guest_name,
        roomNumber: ctx.payload.roomNumber ? String(ctx.payload.roomNumber) : null,
        checkOut: ctx.reservation.check_out,
        portalToken: String(ctx.payload.portalToken),
      }),
      {
        templateKey: 'guest_checked_in',
        hotelId: ctx.reservation.hotel_id,
        channel: 'sms',
      },
    )
  }

  if (ctx.toStatus === 'cancelled' && ctx.payload?.guestPhone) {
    const { notifyGuestReservationCancelled } = await import('@/lib/notifications/stays')
    runNotifyTask(
      notifyGuestReservationCancelled({
        hotelId: ctx.reservation.hotel_id,
        phone: String(ctx.payload.guestPhone),
        guestName: ctx.reservation.guest_name,
        checkIn: ctx.reservation.check_in,
        checkOut: ctx.reservation.check_out,
      }),
      {
        templateKey: 'reservation_cancelled',
        hotelId: ctx.reservation.hotel_id,
        channel: 'sms',
      },
    )
  }
}

export async function runFolioSideEffect(ctx: SideEffectContext): Promise<void> {
  if (ctx.toStatus === 'checked_in') {
    // Folio opens implicitly when guest_charges are posted; no separate open row.
    return
  }
  if (ctx.toStatus === 'checkout_in_progress') {
    // folio_locked set in RPC
    return
  }
  if (ctx.toStatus === 'overstay') {
    const { applyOverstayCharge } = await import('@/lib/reservations/lifecycle-charges')
    await applyOverstayCharge(ctx.admin, ctx.reservation, ctx.actorId)
  }
}

export function resolveRoomStatusForTransition(
  toStatus: ReservationStatus,
): 'occupied' | 'cleaning' | null {
  if (toStatus === 'checked_in' || toStatus === 'dispute_hold' || toStatus === 'overstay') {
    return 'occupied'
  }
  if (toStatus === 'checked_out' || toStatus === 'walkout') return 'cleaning'
  return null
}

export async function runRoomStatusSideEffect(ctx: SideEffectContext): Promise<string | null> {
  return resolveRoomStatusForTransition(ctx.toStatus)
}

export async function runPaymentSideEffect(ctx: SideEffectContext): Promise<void> {
  if (ctx.toStatus === 'confirmed') {
    const token = ctx.payload?.paymentToken
    if (token !== undefined && token !== null && String(token).length < 4) {
      throw new Error('Invalid payment token on record.')
    }
  }
  if (ctx.toStatus === 'no_show') {
    const { applyNoShowCharge } = await import('@/lib/reservations/lifecycle-charges')
    let policy = ctx.payload?.policy as import('@/types').NoShowChargePolicy | undefined
    if (!policy) {
      const { data: hotel } = await ctx.admin
        .from('hotels')
        .select('no_show_charge_policy')
        .eq('id', ctx.reservation.hotel_id)
        .maybeSingle()
      policy = (hotel?.no_show_charge_policy ?? 'one_night') as import('@/types').NoShowChargePolicy
    }
    await applyNoShowCharge(ctx.admin, ctx.reservation, policy, ctx.actorId)

    if (ctx.payload?.holdRoom && ctx.reservation.room_id) {
      const { data: hotelTzRow } = await ctx.admin
        .from('hotels')
        .select('timezone')
        .eq('id', ctx.reservation.hotel_id)
        .maybeSingle()
      const { hotelTodayISO, addDaysISO, normalizeHotelTimezone } = await import('@/lib/hotel-time')
      const tz = normalizeHotelTimezone(hotelTzRow?.timezone)
      const heldUntil = addDaysISO(hotelTodayISO(tz), 1)

      await ctx.admin
        .from('reservations')
        .update({ room_held_until: heldUntil })
        .eq('id', ctx.reservation.id)
        .eq('hotel_id', ctx.reservation.hotel_id)

      await ctx.admin
        .from('rooms')
        .update({
          status: 'occupied',
          updated_by: ctx.actorId ?? null,
        })
        .eq('id', ctx.reservation.room_id)
        .eq('hotel_id', ctx.reservation.hotel_id)
    }
  }
}

export async function runChannelSideEffect(ctx: SideEffectContext): Promise<void> {
  // Airbnb/OTA calendars are pulled via iCal cron (`lib/ical/sync-import.ts`).
  // Export feeds (`/api/ical/[token]`) publish PMS occupancy back to Airbnb.
  // No push webhook exists for Airbnb iCal — availability updates on the next fetch.
  void ctx
}

export async function runSideEffects(
  effects: TransitionSideEffect[],
  ctx: SideEffectContext,
): Promise<{ holdSource?: 'online' | 'phone' | 'agent'; holdMinutes?: number; roomStatus: string | null }> {
  let holdSource: 'online' | 'phone' | 'agent' | undefined
  let holdMinutes: number | undefined
  let roomStatus: string | null = null

  for (const effect of effects) {
    switch (effect) {
      case 'inventory':
        await runInventorySideEffect(ctx)
        break
      case 'hold-timer': {
        const hold = await runHoldTimerSideEffect(ctx)
        holdSource = hold.holdSource
        holdMinutes = hold.holdMinutes
        break
      }
      case 'notifications':
        await runNotificationsSideEffect(ctx)
        break
      case 'folio':
        await runFolioSideEffect(ctx)
        break
      case 'room-status':
        roomStatus = await runRoomStatusSideEffect(ctx)
        break
      case 'payment':
        await runPaymentSideEffect(ctx)
        break
      case 'channel':
        await runChannelSideEffect(ctx)
        break
      default:
        break
    }
  }

  return { holdSource, holdMinutes, roomStatus }
}

/** Effects that must run before the atomic status RPC (hold timer, room status for RPC). */
export const PRE_RPC_SIDE_EFFECTS = new Set<TransitionSideEffect>(['hold-timer', 'room-status'])

/** Effects with ledger writes or notifications — run only after a successful RPC. */
export const POST_RPC_SIDE_EFFECTS = new Set<TransitionSideEffect>([
  'inventory',
  'notifications',
  'folio',
  'payment',
  'channel',
])

export function partitionSideEffects(effects: TransitionSideEffect[]): {
  pre: TransitionSideEffect[]
  post: TransitionSideEffect[]
} {
  const pre: TransitionSideEffect[] = []
  const post: TransitionSideEffect[] = []
  for (const effect of effects) {
    if (PRE_RPC_SIDE_EFFECTS.has(effect)) pre.push(effect)
    else if (POST_RPC_SIDE_EFFECTS.has(effect)) post.push(effect)
  }
  return { pre, post }
}
