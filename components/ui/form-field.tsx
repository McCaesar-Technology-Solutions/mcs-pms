import { cn } from '@/lib/utils'

export const APP_FIELD_CLASS = 'app-field'

export const FORM_FIELD_LABEL_CLASS =
  'mb-1.5 block text-sm font-medium text-foreground'

export interface FormFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  labelClassName?: string
  hintClassName?: string
  children: React.ReactNode
}

/** Shared label + field wrapper for staff modals and forms. */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  labelClassName,
  hintClassName,
  children,
}: FormFieldProps) {
  const labelEl = (
    <>
      {label}
      {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      {required && <span className="sr-only"> (required)</span>}
    </>
  )

  const labelClass = cn(FORM_FIELD_LABEL_CLASS, labelClassName)

  return (
    <div className={cn('block', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {labelEl}
        </label>
      ) : (
        <span className={labelClass}>{labelEl}</span>
      )}
      {children}
      {hint && !error && (
        <p className={cn('mt-1.5 text-xs text-muted-foreground', hintClassName)}>{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
