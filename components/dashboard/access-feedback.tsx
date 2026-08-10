import { AlertCircle, CheckCircle2 } from 'lucide-react'

type Props = {
  error?: string | null
  message?: string | null
  className?: string
}

/** Success / error with icon + text (not color alone). */
export function AccessFeedback({ error, message, className }: Props) {
  if (!error && !message) return null
  return (
    <div className={className ? `space-y-2 ${className}` : 'space-y-2'}>
      {error ? (
        <p
          className="flex items-start gap-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
      {message ? (
        <p
          className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  )
}
