'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SidebarNavLinkProps {
  href: string
  title?: string
  collapsed?: boolean
  active?: boolean
  className?: string
  onNavigate?: () => void
  children: ReactNode
}

export function SidebarNavLink({
  href,
  title,
  collapsed = false,
  active = false,
  className,
  onNavigate,
  children,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      prefetch
      onClick={() => onNavigate?.()}
      className={cn(
        'sidebar-nav-link',
        collapsed ? 'sidebar-nav-link--collapsed' : 'sidebar-nav-link--expanded',
        active && 'sidebar-nav-link--active',
        className,
      )}
    >
      {children}
    </Link>
  )
}
