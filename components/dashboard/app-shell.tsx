'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/dashboard/sidebar'
import Topbar from '@/components/dashboard/topbar'
import type { NavItem } from '@/lib/navigation'
import type { Profile } from '@/types'
import { ManagerRealtimeProvider } from '@/components/realtime/manager-realtime'

interface AppShellProps {
  children: React.ReactNode
  navigation?: NavItem[]
  profile?: Profile | null
  enableRealtime?: boolean
}

export function AppShell({
  children,
  navigation,
  profile,
  enableRealtime = false,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const content = (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        navigation={navigation}
      />
      <main className="app-main h-dvh min-w-0 flex-1 overflow-y-auto">
        <Topbar onMenuOpen={() => setMobileNavOpen(true)} profile={profile} />
        {children}
      </main>
    </div>
  )

  if (enableRealtime && profile?.hotel_id) {
    return (
      <ManagerRealtimeProvider hotelId={profile.hotel_id}>
        {content}
      </ManagerRealtimeProvider>
    )
  }

  return content
}
