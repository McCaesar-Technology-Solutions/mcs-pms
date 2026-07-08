'use client'

import type { ReactNode } from 'react'
import { StaffThemeInitScript } from '@/components/providers/staff-theme-init-script'
import { StaffThemeProvider } from '@/components/providers/staff-theme-provider'

export function MobileStaffShell({ children }: { children: ReactNode }) {
  return (
    <StaffThemeProvider>
      <StaffThemeInitScript />
      <div className="min-h-dvh bg-background text-foreground antialiased">{children}</div>
    </StaffThemeProvider>
  )
}
