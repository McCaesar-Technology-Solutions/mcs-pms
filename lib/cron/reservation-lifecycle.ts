import { createAdminClient } from '@/lib/supabase/admin'
import { findAvailableRooms } from '@/lib/data/occupancy'
import { appendReservationEvent, transitionReservation } from '@/lib/reservations/state-machine'
import {
  isPastHotelCheckoutTime,
  todayISO,
} from '@/lib/reservations/check-out-time'
import { preArrivalPromotionCheckInDates } from '@/lib/cron/reservation-pre-arrival'
import {
  guestInHouseOnOtherReservation,
  hasRecentOtaCancellation,
  shouldAutoCheckoutPrompt,
  shouldMarkOverstay,
} from '@/lib/cron/reservation-lifecycle-guards'
import { notifyManagers } from '@/lib/notifications/manager-notify'
import { runNotifyTask } from '@/lib/notifications/notify-task'
import { appUrl } from '@/lib/notifications/app-url'

type Admin = ReturnType<typeof createAdminClient>

interface HotelLifecycleRow {
  id: string
  use_lifecycle_v2: boolean
  guest_portal_check_out_time: string | null
  no_show_time: string | null
  post_stay_archive_delay_days: number
  no_show_charge_policy: string
  no_show_hold_room: boolean
}

async function lifecycleHotels(admin: Admin): Promise<HotelLifecycleRow[]> {
  const { data } = await admin
    .from('hotels')
    .select(
      'id, use_lifecycle_v2, guest_portal_check_out_time, no_show_time, post_stay_archive_delay_days, no_show_charge_policy, no_show_hold_room',
    )
    .eq('use_lifecycle_v2', true)

  return (data ?? []) as HotelLifecycleRow[]
}

function isPastNoShowTime(noShowTime: string | null): boolean {
  return isPastHotelCheckoutTime(noShowTime ?? '23:59')
}

export async function processExpiredReservationHolds(): Promise<{ processed: number; skipped: number }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  let processed = 0
  let skipped = 0

  const { data: holds } = await admin
    .from('reservation_holds')
    .select('reservation_id')
    .lte('expires_at', now)
    .is('released_at', null)

  for (const hold of holds ?? []) {
    const { data: res } = await admin
      .from('reservations')
      .select('id, hotel_id, status, hotels!inner(use_lifecycle_v2)')
      .eq('id', hold.reservation_id)
      .maybeSingle()

    if (!res) {
      skipped++
      continue
    }

    const hotel = res.hotels as { use_lifecycle_v2: boolean } | null
    if (!hotel?.use_lifecycle_v2) {
      skipped++
      continue
    }
    if (res.status !== 'provisional') {
      skipped++
      continue
    }

    const result = await transitionReservation({
      reservationId: res.id,
      hotelId: res.hotel_id,
      toStatus: 'released',
      actorRole: 'system',
      bypassRoleCheck: true,
      eventType: 'hold_expired',
    })
    if (result.success) processed++
    else skipped++
  }

  return { processed, skipped }
}

export async function processPreArrivalReservations(): Promise<{ processed: number; skipped: number }> {
  const admin = createAdminClient()
  const today = todayISO()
  const checkInDates = preArrivalPromotionCheckInDates(today)
  let processed = 0
  let skipped = 0

  for (const hotel of await lifecycleHotels(admin)) {
    const { data: rows } = await admin
      .from('reservations')
      .select('id, hotel_id, room_id, check_in, check_out, guest_name')
      .eq('hotel_id', hotel.id)
      .eq('status', 'confirmed')
      .in('check_in', checkInDates)

    for (const row of rows ?? []) {
      if (!row.room_id) {
        const rooms = await findAvailableRooms(admin, hotel.id, row.check_in, row.check_out)
        const first = rooms[0]
        if (first) {
          await admin.from('reservations').update({ room_id: first.id }).eq('id', row.id)
        }
      }

      await appendReservationEvent({
        reservationId: row.id,
        hotelId: hotel.id,
        eventType: 'pre_arrival_skipped_preauth',
        actorRole: 'system',
        payload: {
          reason: 'no_gateway',
          trigger: row.check_in === today ? 'arrival_day_catchup' : 'two_days_before',
        },
      }).catch(() => undefined)

      const result = await transitionReservation({
        reservationId: row.id,
        hotelId: hotel.id,
        toStatus: 'pre_arrival',
        actorRole: 'system',
        bypassRoleCheck: true,
      })
      if (result.success) processed++
      else skipped++
    }
  }

  return { processed, skipped }
}

export async function processNoShowReservations(): Promise<{ processed: number; skipped: number }> {
  const admin = createAdminClient()
  const today = todayISO()
  let processed = 0
  let skipped = 0

  for (const hotel of await lifecycleHotels(admin)) {
    if (!isPastNoShowTime(hotel.no_show_time)) continue

    const { data: inHouse } = await admin
      .from('reservations')
      .select('guest_id')
      .eq('hotel_id', hotel.id)
      .eq('status', 'checked_in')

    const inHouseGuestIds = (inHouse ?? [])
      .map((r) => r.guest_id)
      .filter((id): id is string => Boolean(id))

    const { data: rows } = await admin
      .from('reservations')
      .select('id, hotel_id, guest_id, guest_name, amount_paid')
      .eq('hotel_id', hotel.id)
      .eq('status', 'pre_arrival')
      .eq('check_in', today)

    for (const row of rows ?? []) {
      if (guestInHouseOnOtherReservation(inHouseGuestIds, row.guest_id)) {
        skipped++
        continue
      }

      const { data: events } = await admin
        .from('reservation_events')
        .select('event_type, created_at')
        .eq('reservation_id', row.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (hasRecentOtaCancellation(events ?? [])) {
        skipped++
        continue
      }

      await appendReservationEvent({
        reservationId: row.id,
        hotelId: hotel.id,
        eventType: 'no_show_notification_attempted',
        actorRole: 'system',
      })

      const result = await transitionReservation({
        reservationId: row.id,
        hotelId: hotel.id,
        toStatus: 'no_show',
        actorRole: 'system',
        bypassRoleCheck: true,
        payload: {
          policy: hotel.no_show_charge_policy,
          holdRoom: hotel.no_show_hold_room,
          amountPaid: row.amount_paid,
        },
        skipRoomStatus: hotel.no_show_hold_room,
      })

      if (result.success) processed++
      else skipped++
    }
  }

  return { processed, skipped }
}

export async function processOverstayReservations(): Promise<{ processed: number; skipped: number }> {
  const admin = createAdminClient()
  const today = todayISO()
  let processed = 0
  let skipped = 0

  for (const hotel of await lifecycleHotels(admin)) {
    if (!isPastHotelCheckoutTime(hotel.guest_portal_check_out_time)) continue

    const { data: rows } = await admin
      .from('reservations')
      .select('id, hotel_id, guest_name, check_out, status')
      .eq('hotel_id', hotel.id)
      .eq('status', 'checked_in')
      .eq('check_out', today)

    for (const row of rows ?? []) {
      const { data: events } = await admin
        .from('reservation_events')
        .select('event_type, created_at')
        .eq('reservation_id', row.id)

      if (
        !shouldMarkOverstay({
          status: row.status ?? '',
          departureDate: row.check_out,
          today,
          pastCheckoutTime: true,
          events: events ?? [],
        })
      ) {
        skipped++
        continue
      }

      const result = await transitionReservation({
        reservationId: row.id,
        hotelId: hotel.id,
        toStatus: 'overstay',
        actorRole: 'system',
        bypassRoleCheck: true,
      })

      if (result.success) {
        processed++
        runNotifyTask(
          notifyManagers({
            hotelId: hotel.id,
            templateKey: 'reservation_overstay',
            smsBody: `MOJO: Overstay — ${row.guest_name} (departure ${row.check_out}). Front desk follow-up needed.`,
            email: {
              subject: `Overstay alert · ${row.guest_name}`,
              preview: 'A guest has passed checkout time without departing.',
              lines: [`Guest: ${row.guest_name}`, `Scheduled departure: ${row.check_out}`],
              actionUrl: appUrl('/manager/reservations'),
              actionLabel: 'View reservations',
            },
          }),
          {
            templateKey: 'reservation_overstay',
            hotelId: hotel.id,
          },
        )
      } else {
        skipped++
      }
    }
  }

  return { processed, skipped }
}

export async function processAutoCheckoutPrompts(): Promise<{ processed: number; skipped: number }> {
  const admin = createAdminClient()
  const today = todayISO()
  let processed = 0
  let skipped = 0

  for (const hotel of await lifecycleHotels(admin)) {
    if (!isPastHotelCheckoutTime(hotel.guest_portal_check_out_time)) continue

    const { data: rows } = await admin
      .from('reservations')
      .select('id, hotel_id, check_out, status')
      .eq('hotel_id', hotel.id)
      .eq('status', 'checked_in')
      .eq('check_out', today)

    for (const row of rows ?? []) {
      const { data: events } = await admin
        .from('reservation_events')
        .select('event_type, created_at')
        .eq('reservation_id', row.id)

      if (
        !shouldAutoCheckoutPrompt({
          status: row.status ?? '',
          departureDate: row.check_out,
          today,
          pastCheckoutTime: true,
          events: events ?? [],
        })
      ) {
        skipped++
        continue
      }

      const result = await transitionReservation({
        reservationId: row.id,
        hotelId: hotel.id,
        toStatus: 'checkout_in_progress',
        actorRole: 'system',
        bypassRoleCheck: true,
      })

      if (result.success) processed++
      else skipped++
    }
  }

  return { processed, skipped }
}

export async function processArchiveReservations(): Promise<{ processed: number; skipped: number }> {
  const admin = createAdminClient()
  let processed = 0
  let skipped = 0

  for (const hotel of await lifecycleHotels(admin)) {
    const delayDays = hotel.post_stay_archive_delay_days ?? 30
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - delayDays)

    const { data: rows } = await admin
      .from('reservations')
      .select('id, hotel_id, checked_out_at')
      .eq('hotel_id', hotel.id)
      .eq('status', 'post_stay')
      .not('checked_out_at', 'is', null)
      .lt('checked_out_at', cutoff.toISOString())

    for (const row of rows ?? []) {
      const result = await transitionReservation({
        reservationId: row.id,
        hotelId: hotel.id,
        toStatus: 'archived',
        actorRole: 'system',
        bypassRoleCheck: true,
      })
      if (result.success) processed++
      else skipped++
    }
  }

  return { processed, skipped }
}
