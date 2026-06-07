'use client'

import { PropertyProvider } from '@/lib/property-context'
import type { ReactNode } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
  return <PropertyProvider>{children}</PropertyProvider>
}
