import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface PageContextSegment {
  label: string
  href?: string
}

interface PageContextBarProps {
  segments: PageContextSegment[]
  className?: string
}

/** Lightweight breadcrumb trail for deep staff views. */
export function PageContextBar({ segments, className = '' }: PageContextBarProps) {
  if (segments.length === 0) return null

  return (
    <nav
      aria-label="Page context"
      className={`page-context-bar flex flex-wrap items-center gap-1 text-xs text-muted-foreground ${className}`.trim()}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        return (
          <span key={`${segment.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />}
            {segment.href && !isLast ? (
              <Link href={segment.href} className="truncate font-medium hover:text-foreground hover:underline">
                {segment.label}
              </Link>
            ) : (
              <span className={`truncate ${isLast ? 'font-semibold text-foreground' : 'font-medium'}`}>
                {segment.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
