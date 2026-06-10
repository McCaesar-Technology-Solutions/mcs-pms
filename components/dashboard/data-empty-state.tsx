interface DataEmptyStateProps {
  title?: string
  message: string
  className?: string
}

export function DataEmptyState({
  title,
  message,
  className = '',
}: DataEmptyStateProps) {
  return (
    <div className={`surface-card p-10 text-center ${className}`}>
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <p className={`text-sm text-muted-foreground ${title ? 'mt-2' : ''}`}>{message}</p>
    </div>
  )
}
