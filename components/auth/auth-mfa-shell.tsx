import Link from 'next/link'

interface AuthMfaShellProps {
  title: string
  description: string
  children: React.ReactNode
}

/** Shared layout for sign-in verification pages (matches login styling). */
export function AuthMfaShell({ title, description, children }: AuthMfaShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p
            className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold tracking-wide text-[#D4A62E]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
            MOJO APARTMENTS
          </p>
          <p className="mt-2 text-sm text-white/70">{title}</p>
        </div>
        <p className="mb-6 text-sm text-white/70">{description}</p>
        {children}
        <p className="mt-6 text-center text-xs text-white/45">
          <Link href="/login" className="font-semibold text-[#D4A62E] hover:underline">
            Sign out and use another account
          </Link>
        </p>
      </div>
    </div>
  )
}
