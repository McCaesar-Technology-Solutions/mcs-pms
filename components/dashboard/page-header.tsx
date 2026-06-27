import type { ReactNode } from 'react'
import { DarkSection } from '@/components/dashboard/dark-section'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  /** Slim header for inner panels — stays on light background. */
  compact?: boolean
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  badge,
  compact = false,
  actions,
}: PageHeaderProps) {
  if (compact) {
    return (
      <header className="mb-1">
        {badge && (
          <span className="mb-1.5 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {badge}
          </span>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </header>
    )
  }

  return (
    <DarkSection variant="ops" className="page-header-bleed dashboard-section">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {badge && <p className="label-eyebrow label-eyebrow-accent">{badge}</p>}
          <h1 className="font-display mt-1 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/58">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
    </DarkSection>
  )
}
