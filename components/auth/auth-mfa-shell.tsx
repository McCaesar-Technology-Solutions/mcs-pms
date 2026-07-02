import Link from 'next/link'

interface AuthMfaShellProps {
  title: string
  description: string
  children: React.ReactNode
}

/** Shared layout for sign-in verification pages (matches login styling). */
export function AuthMfaShell({ title, description, children }: AuthMfaShellProps) {
  return (
    <div className="auth-form-card">
      <div className="mb-8 text-center">
        <p className="auth-brand-title">MOJO APARTMENTS</p>
        <p className="mt-2 text-sm text-white/75">{title}</p>
      </div>
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
