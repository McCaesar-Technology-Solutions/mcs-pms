import { cn } from '@/lib/utils'

interface FormErrorProps {
  message?: string | null
  variant?: 'light' | 'dark'
  className?: string
}

export function FormError({ message, variant = 'light', className }: FormErrorProps) {
  if (!message?.trim()) return null

  return (
    <p
      role="alert"
      className={cn(
        'text-sm',
        variant === 'dark'
          ? 'text-red-200'
          : 'rounded-lg bg-red-50 px-3 py-2 text-red-700',
        className,
      )}
    >
      {message}
    </p>
  )
}
