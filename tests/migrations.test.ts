import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATION_DIR = join(process.cwd(), 'supabase', 'migrations')
const EXPECTED_COUNT = 60

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

  it('includes security hardening migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('security_hardening'))).toBe(true)
  })

  it('includes owner conversation oversight migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('owner_conversation_oversight'))).toBe(true)
  })

  it('includes security fixes migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('security_fixes'))).toBe(true)
  })

  it('includes performance indexes migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('performance_indexes'))).toBe(true)
  })

  it('includes online payments migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('online_payments'))).toBe(true)
  })
})
