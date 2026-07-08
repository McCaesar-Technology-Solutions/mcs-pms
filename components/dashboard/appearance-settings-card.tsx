'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useStaffTheme } from '@/components/providers/staff-theme-provider'
import { STAFF_THEME_MODES, type StaffThemeMode } from '@/lib/theme/staff-theme'

const MODE_LABELS: Record<StaffThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const MODE_ICONS: Record<StaffThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function AppearanceSettingsCard() {
  const { mode, resolved, setMode } = useStaffTheme()

  return (
    <div className="surface-card rounded-xl border border-border/60 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose how the staff dashboard looks on this device.
          {mode === 'system' && (
            <span className="text-foreground/80">
              {' '}
              Currently using {resolved === 'dark' ? 'dark' : 'light'} mode from your system
              settings.
            </span>
          )}
        </p>
      </div>
      <div className="rooms-view-toggle w-full sm:w-auto" role="radiogroup" aria-label="Theme">
        {STAFF_THEME_MODES.map((option) => {
          const Icon = MODE_ICONS[option]
          const active = mode === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(option)}
              className={`rooms-view-toggle__btn flex-1 justify-center py-2.5 sm:flex-initial ${
                active ? 'rooms-view-toggle__btn--active' : ''
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {MODE_LABELS[option]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
