'use client'

import { Moon, Sun } from 'lucide-react'
import { useStaffTheme } from '@/components/providers/staff-theme-provider'

interface StaffThemeToggleProps {
  className?: string
}

export function StaffThemeToggle({ className = 'topbar-icon-btn' }: StaffThemeToggleProps) {
  const { resolved, toggleResolved, mode } = useStaffTheme()
  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      onClick={toggleResolved}
      className={className}
      aria-label={
        isDark
          ? 'Switch to light mode'
          : 'Switch to dark mode'
      }
      title={
        mode === 'system'
          ? `System theme (${isDark ? 'dark' : 'light'}) — click to override`
          : isDark
            ? 'Light mode'
            : 'Dark mode'
      }
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}
