import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATION_DIR = join(process.cwd(), 'supabase', 'migrations')
const EXPECTED_COUNT = 74

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

  it('includes receptionist invoice read access', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('receptionist_invoice_access'))).toBe(true)
  })

  it('includes performance indexes migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('performance_indexes'))).toBe(true)
  })

  it('includes online payments migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('online_payments'))).toBe(true)
  })

  it('includes access control migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('access_control'))).toBe(true)
  })

  it('includes access device cloud secrets migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('access_device_cloud_secrets'))).toBe(true)
  })

  it('includes hotel timezone and no-show room hold migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('hotel_timezone_no_show_hold'))).toBe(true)
  })

  it('includes iCal sync hardening migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('ical_sync_hardening'))).toBe(true)
  })

  it('includes payroll migrations', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('payroll'))).toBe(true)
    expect(files.some((f) => f.includes('payroll_rls_hardening'))).toBe(true)
  })

  it('includes access persons/policies/attendance migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('access_persons_policies_attendance'))).toBe(true)
  })

  it('includes attendance dedupe migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('attendance_dedupe'))).toBe(true)
  })

  it('includes weekly rates migration', () => {
    const files = readdirSync(MIGRATION_DIR)
    expect(files.some((f) => f.includes('weekly_rates'))).toBe(true)
  })
})
