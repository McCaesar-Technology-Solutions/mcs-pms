'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  readStoredStaffThemeMode,
  resolveStaffTheme,
  STAFF_THEME_STORAGE_KEY,
  type ResolvedStaffTheme,
  type StaffThemeMode,
} from '@/lib/theme/staff-theme'

interface StaffThemeContextValue {
  mode: StaffThemeMode
  resolved: ResolvedStaffTheme
  setMode: (mode: StaffThemeMode) => void
  toggleResolved: () => void
}

const StaffThemeContext = createContext<StaffThemeContextValue | null>(null)

export function StaffThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StaffThemeMode>('system')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  useEffect(() => {
    setModeState(readStoredStaffThemeMode())
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemPrefersDark(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const resolved = resolveStaffTheme(mode, systemPrefersDark)

  useEffect(() => {
    document.documentElement.classList.toggle('staff-dark', resolved === 'dark')
    return () => {
      document.documentElement.classList.remove('staff-dark')
    }
  }, [resolved])

  const setMode = useCallback((next: StaffThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STAFF_THEME_STORAGE_KEY, next)
    } catch {
      /* ignore storage errors */
    }
  }, [])

  const toggleResolved = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setMode])

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggleResolved }),
    [mode, resolved, setMode, toggleResolved],
  )

  return <StaffThemeContext.Provider value={value}>{children}</StaffThemeContext.Provider>
}

export function useStaffTheme(): StaffThemeContextValue {
  const ctx = useContext(StaffThemeContext)
  if (!ctx) {
    throw new Error('useStaffTheme must be used within StaffThemeProvider')
  }
  return ctx
}
