import Link from 'next/link'
import { MapPinOff } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--brand-purple-ink)] px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--brand-gold)]/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[var(--brand-purple)]/25 blur-3xl" />
      </div>
      <div className="relative">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <MapPinOff className="h-7 w-7 text-[var(--brand-gold)]" strokeWidth={1.75} />
        </div>
        <p className="font-display text-4xl font-semibold tracking-tight text-[var(--brand-gold)]">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
          This route does not exist or you may not have access. Head back to sign in or your dashboard.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="guest-btn guest-btn-primary inline-flex px-6 py-3 text-sm"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="guest-btn guest-btn-ghost inline-flex px-6 py-3 text-sm ring-1 ring-white/15"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
