/**
 * One-time backfill: seed reservation_events from existing reservations + audit_log.
 * Idempotent — skips reservations that already have events.
 *
 * Usage: npx tsx scripts/backfill-reservation-events.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const STATUS_EVENT: Record<string, string> = {
  inquiry: 'backfill_inquiry',
  provisional: 'backfill_provisional',
  confirmed: 'backfill_confirmed',
  pre_arrival: 'backfill_pre_arrival',
  checked_in: 'backfill_checked_in',
  checkout_in_progress: 'backfill_checkout_in_progress',
  checked_out: 'backfill_checked_out',
  post_stay: 'backfill_post_stay',
  archived: 'backfill_archived',
  no_show: 'backfill_no_show',
  cancelled: 'backfill_cancelled',
  released: 'backfill_released',
  overstay: 'backfill_overstay',
  walkout: 'backfill_walkout',
}

async function main() {
  const { data: reservations, error } = await admin
    .from('reservations')
    .select('id, hotel_id, status, created_at')

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  let inserted = 0
  let skipped = 0

  for (const row of reservations ?? []) {
    const { count } = await admin
      .from('reservation_events')
      .select('id', { count: 'exact', head: true })
      .eq('reservation_id', row.id)

    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    const status = row.status ?? 'confirmed'
    const { error: insertError } = await admin.from('reservation_events').insert({
      reservation_id: row.id,
      hotel_id: row.hotel_id,
      event_type: STATUS_EVENT[status] ?? 'backfill_snapshot',
      from_status: null,
      to_status: status,
      actor_role: 'backfill',
      payload: { source: 'backfill-reservation-events', created_at: row.created_at },
    })

    if (insertError) {
      console.error(`Failed ${row.id}:`, insertError.message)
      continue
    }
    inserted++
  }

  console.log(`Backfill complete. inserted=${inserted} skipped=${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
