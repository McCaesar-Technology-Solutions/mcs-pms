import { describe, expect, it } from 'vitest'
import { isStaffThemeMode, resolveStaffTheme } from '@/lib/theme/staff-theme'

describe('staff theme', () => {
  it('resolves system mode from OS preference', () => {
    expect(resolveStaffTheme('system', true)).toBe('dark')
    expect(resolveStaffTheme('system', false)).toBe('light')
  })

  it('honors explicit light and dark modes', () => {
    expect(resolveStaffTheme('light', true)).toBe('light')
    expect(resolveStaffTheme('dark', false)).toBe('dark')
  })

  it('validates stored theme modes', () => {
    expect(isStaffThemeMode('light')).toBe(true)
    expect(isStaffThemeMode('dark')).toBe(true)
    expect(isStaffThemeMode('system')).toBe(true)
    expect(isStaffThemeMode('sepia')).toBe(false)
    expect(isStaffThemeMode(null)).toBe(false)
  })
})
