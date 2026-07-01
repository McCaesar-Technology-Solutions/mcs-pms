'use client'

import { PropertyProvider } from '@/lib/property-context'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import type { ReactNode } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PropertyProvider>
      <ServiceWorkerRegister />
      {children}
    </PropertyProvider>
  )
}
