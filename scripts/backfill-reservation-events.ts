/**
 * One-time backfill: seed reservation_events from existing reservations.
 * Idempotent — skips reservations that already have events.
 *
 * Usage: npx tsx scripts/backfill-reservation-events.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  try {
    const envFile = readFileSync(join(root, '.env.local'), 'utf8')
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local optional if vars are exported in the shell
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Missing Supabase credentials. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (same as npm run dev), or export them in your shell.',
  )
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
