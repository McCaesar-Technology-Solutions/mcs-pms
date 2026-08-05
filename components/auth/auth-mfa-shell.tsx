import Link from 'next/link'
import { AuthBrand } from '@/components/brand/auth-brand'

interface AuthMfaShellProps {
  title: string
  description: string
  children: React.ReactNode
}

/** Shared layout for sign-in verification pages (matches login styling). */
export function AuthMfaShell({ title, description, children }: AuthMfaShellProps) {
  return (
    <div className="auth-form-card">
      <AuthBrand subtitle={title} />
      <p className="mb-6 text-sm text-white/75">{description}</p>
      {children}
      <p className="mt-6 text-center text-xs text-white/50">
        <Link href="/login" className="font-semibold text-[var(--brand-gold)] hover:underline">
          Sign out and use another account
        </Link>
      </p>
    </div>
  )
}
