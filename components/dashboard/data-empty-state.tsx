interface DataEmptyStateProps {
  title?: string
  message: string
  className?: string
  /** Omit outer surface-card wrapper (for use inside existing cards). */
  borderless?: boolean
}

export function DataEmptyState({
  title,
  message,
  className = '',
  borderless = false,
}: DataEmptyStateProps) {
  const content = (
    <>
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <p className={`text-sm text-muted-foreground ${title ? 'mt-2' : ''}`}>{message}</p>
    </>
  )

  if (borderless) {
    return <div className={`py-8 text-center ${className}`}>{content}</div>
  }

  return <div className={`surface-card p-10 text-center ${className}`}>{content}</div>
}
