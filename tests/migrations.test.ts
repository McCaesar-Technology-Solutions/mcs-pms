import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATION_DIR = join(process.cwd(), 'supabase', 'migrations')
const EXPECTED_COUNT = 51

describe('supabase migrations', () => {
  it(`has contiguous files 001–${String(EXPECTED_COUNT).padStart(3, '0')}`, () => {
    const files = readdirSync(MIGRATION_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    expect(files.length).toBe(EXPECTED_COUNT)

    for (let i = 1; i <= EXPECTED_COUNT; i++) {
      const prefix = String(i).padStart(3, '0')
      expect(files.some((f) => f.startsWith(`${prefix}_`))).toBe(true)
    }
  })

  it('includes reservation lifecycle v2 migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('reservation_lifecycle'))).toBe(true)
  })
})
