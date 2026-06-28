'use client'

import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import type { ReactNode } from 'react'

interface SidebarNavLinkProps {
  href: string
  title?: string
  className?: string
  onNavigate?: () => void
  children: ReactNode
}

function SidebarNavLinkInner({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus()

  return (
    <span className="flex w-full min-w-0 items-center" aria-busy={pending || undefined}>
      {children}
    </span>
  )
}

export function SidebarNavLink({
  href,
  title,
  className,
  onNavigate,
  children,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      prefetch
      onClick={onNavigate}
      className={className}
    >
      <SidebarNavLinkInner>{children}</SidebarNavLinkInner>
    </Link>
  )
}
