'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, MessageCircle } from 'lucide-react'
import { useMessagesNavBadge } from '@/components/staff-messages/use-messages-nav-badge'

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="technician-bottom-nav__badge">{count > 9 ? '9+' : count}</span>
  )
}

export function TechnicianBottomNav() {
  const pathname = usePathname()
  const unreadMessages = useMessagesNavBadge('/technician/messages')

  return (
    <nav className="technician-bottom-nav" aria-label="Technician navigation">
      <Link
        href="/technician/tasks"
        className={`technician-bottom-nav__item ${pathname.startsWith('/technician/tasks') ? 'technician-bottom-nav__item--active' : ''}`}
      >
        <ClipboardList className="h-5 w-5" aria-hidden />
        Tasks
      </Link>
      <Link
        href="/technician/messages"
        className={`technician-bottom-nav__item ${pathname.startsWith('/technician/messages') ? 'technician-bottom-nav__item--active' : ''}`}
      >
        <span className="relative inline-flex">
          <MessageCircle className="h-5 w-5" aria-hidden />
          <NavBadge count={unreadMessages} />
        </span>
        Messages
      </Link>
    </nav>
  )
}
