import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface DataEmptyStateProps {
  title?: string
  message: string
  className?: string
  /** Omit outer surface-card wrapper (for use inside existing cards). */
  borderless?: boolean
  icon?: LucideIcon
  action?: React.ReactNode
}

export function DataEmptyState({
  title,
  message,
  className = '',
  borderless = false,
  icon: Icon = Inbox,
  action,
}: DataEmptyStateProps) {
  const content = (
    <>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
        <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
      </div>
      {title && <p className="text-base font-semibold text-foreground">{title}</p>}
      <p className={`mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground ${title ? 'mt-2' : ''}`}>
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </>
  )

  if (borderless) {
    return <div className={`py-10 text-center ${className}`}>{content}</div>
  }

  return <div className={`surface-card p-10 text-center ${className}`}>{content}</div>
}
