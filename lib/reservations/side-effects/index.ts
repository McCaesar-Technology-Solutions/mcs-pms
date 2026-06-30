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
  if (toStatus === 'checked_in') return 'occupied'
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
  }
}

export async function runChannelSideEffect(ctx: SideEffectContext): Promise<void> {
  if (['confirmed', 'cancelled', 'checked_out'].includes(ctx.toStatus)) {
    // TODO(phase-2): OTA notify when iCal integration ships — see checkout-logic spec
    void ctx
  }
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
