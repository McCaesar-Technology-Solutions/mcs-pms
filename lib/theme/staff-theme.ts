export const STAFF_THEME_STORAGE_KEY = 'mojo-staff-theme'

export type StaffThemeMode = 'light' | 'dark' | 'system'

export const STAFF_THEME_MODES: StaffThemeMode[] = ['light', 'dark', 'system']

export type ResolvedStaffTheme = 'light' | 'dark'

export function isStaffThemeMode(value: string | null): value is StaffThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveStaffTheme(
  mode: StaffThemeMode,
  systemPrefersDark: boolean,
): ResolvedStaffTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return mode
}

export function readStoredStaffThemeMode(): StaffThemeMode {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(STAFF_THEME_STORAGE_KEY)
    return isStaffThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export const STAFF_THEME_INIT_SCRIPT = `(function(){try{var k='${STAFF_THEME_STORAGE_KEY}';var m=localStorage.getItem(k);var d=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('staff-dark',d);}catch(e){}})();`
