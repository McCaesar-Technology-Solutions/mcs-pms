/**
 * One-time backfill: align payment_records with cached amount_paid on reservations/invoices.
 *
 * Usage:
 *   npx tsx scripts/backfill-payment-records.ts           # all hotels
 *   npx tsx scripts/backfill-payment-records.ts --dry-run # preview only
 *   npx tsx scripts/backfill-payment-records.ts --hotel=<uuid>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { reconcilePaymentLedger } from '../lib/billing/reconcile-payment-ledger'

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
    'Missing Supabase credentials. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.',
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const dryRun = process.argv.includes('--dry-run')
const hotelArg = process.argv.find((arg) => arg.startsWith('--hotel='))
const hotelFilter = hotelArg?.split('=')[1]

async function main() {
  let hotelIds: string[] = []

  if (hotelFilter) {
    hotelIds = [hotelFilter]
  } else {
    const { data, error } = await admin.from('hotels').select('id, name')
    if (error) {
      console.error('Could not list hotels:', error.message)
      process.exit(1)
    }
    hotelIds = (data ?? []).map((row) => row.id)
    console.log(`Found ${hotelIds.length} hotel(s).`)
  }

  let totals = {
    reservationBackfills: 0,
    invoiceBackfills: 0,
    recordsLinked: 0,
    reservationGapsGhs: 0,
    invoiceGapsGhs: 0,
  }

  for (const hotelId of hotelIds) {
    const { data: hotel } = await admin.from('hotels').select('name').eq('id', hotelId).maybeSingle()
    const label = hotel?.name ?? hotelId
    console.log(`\n${dryRun ? '[dry-run] ' : ''}Reconciling ${label}…`)

    const result = await reconcilePaymentLedger(admin, hotelId, { dryRun })
    totals = {
      reservationBackfills: totals.reservationBackfills + result.reservationBackfills,
      invoiceBackfills: totals.invoiceBackfills + result.invoiceBackfills,
      recordsLinked: totals.recordsLinked + result.recordsLinked,
      reservationGapsGhs: totals.reservationGapsGhs + result.reservationGapsGhs,
      invoiceGapsGhs: totals.invoiceGapsGhs + result.invoiceGapsGhs,
    }

    console.log(
      `  reservation backfills: ${result.reservationBackfills} (₵${result.reservationGapsGhs.toFixed(2)})`,
    )
    console.log(
      `  invoice backfills: ${result.invoiceBackfills} (₵${result.invoiceGapsGhs.toFixed(2)})`,
    )
    console.log(`  deposit records linked to invoices: ${result.recordsLinked}`)
  }

  console.log('\nDone.')
  console.log(
    `${dryRun ? 'Would backfill' : 'Backfilled'} ${totals.reservationBackfills + totals.invoiceBackfills} ledger row(s), linked ${totals.recordsLinked} orphan deposit(s).`,
  )
}

void main()
