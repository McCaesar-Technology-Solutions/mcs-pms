#!/usr/bin/env node
/**
 * Verifies supabase/migrations contains a contiguous 001..N sequence.
 * Does not check whether SQL was applied to a remote database.
 */
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase', 'migrations')

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const numbers = files.map((f) => {
  const match = /^(\d{3})_/.exec(f)
  if (!match) {
    console.error(`Invalid migration filename (expected NNN_name.sql): ${f}`)
    process.exit(1)
  }
  return Number.parseInt(match[1], 10)
})

if (numbers.length === 0) {
  console.error('No migration files found.')
  process.exit(1)
}

const expected = numbers.length
for (let i = 1; i <= expected; i++) {
  if (numbers[i - 1] !== i) {
    console.error(`Missing migration ${String(i).padStart(3, '0')}. Found: ${files.join(', ')}`)
    process.exit(1)
  }
}

console.log(`OK: ${expected} migrations (001–${String(expected).padStart(3, '0')})`)
