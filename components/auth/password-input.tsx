'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement>

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((show) => !show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/50 transition hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]/50"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
}
