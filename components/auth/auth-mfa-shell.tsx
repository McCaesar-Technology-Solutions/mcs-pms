import { signOut } from '@/app/actions/auth'
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
      <form action={signOut} className="mt-6 text-center">
        <button
          type="submit"
          className="text-xs font-semibold text-[var(--brand-gold)] hover:underline"
        >
          Sign out and use another account
        </button>
      </form>
    </div>
  )
}
