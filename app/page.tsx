import Link from 'next/link'
import { getProfile } from '@/lib/auth/get-profile'
import { ROLE_HOME } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Shield,
  Smartphone,
  Sparkles,
} from 'lucide-react'

export default async function LandingPage() {
  const profile = await getProfile()
  if (profile && profile.is_active !== false) {
    if (profile.role === 'owner' && !profile.onboarding_completed_at) {
      redirect('/get-started')
    }
    redirect(ROLE_HOME[profile.role])
  }

  return (
    <div className="min-h-dvh bg-[#22124C] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p
          className="text-xl font-semibold tracking-wide text-[#D4A62E]"
          style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
        >
          MOJO APARTMENTS
        </p>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-white/75 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#D4A62E] px-4 py-2 font-semibold text-[#22124C] hover:bg-[#e0b64a]"
          >
            Start free trial
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <section className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#D4A62E]/30 bg-[#D4A62E]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#F5DFA0]">
              <Sparkles className="h-3.5 w-3.5" />
              Built for Ghana hotels & short-stay rentals
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Run your property on one dashboard — from booking to GRA invoice.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Reservations, housekeeping, guest complaints, Paystack payments, OTA calendar sync, and
              GRA tax reports — without spreadsheets or five different apps.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#D4A62E] px-6 font-semibold text-[#22124C] hover:bg-[#e0b64a]"
              >
                Start 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 font-semibold text-white hover:bg-white/5"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/45">No credit card · Up to 2 properties during trial</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Calendar, title: 'Front desk & reservations', text: 'Check-in/out, room moves, no-shows, walk-ins.' },
              { icon: BarChart3, title: 'GRA-ready billing', text: 'NHIL, GETFund, COVID levy, VAT, e-levy on every checkout invoice.' },
              { icon: Smartphone, title: 'Guest portal', text: 'Complaints, folio, Paystack pay — no guest password needed.' },
              { icon: Shield, title: 'Production security', text: 'MFA for owners, rate limits, RLS tenant isolation, audit log.' },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <Icon className="mb-3 h-6 w-6 text-[#D4A62E]" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 rounded-3xl border border-white/10 bg-gradient-to-br from-[#3C216C]/80 to-[#22124C] p-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready in minutes, not weeks</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65">
            Sign up, walk through guided setup, and your first property is live with rooms, rates, and
            export calendars for Airbnb and Booking.com.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-[#22124C] hover:bg-white/90"
          >
            Create your account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/40">
        <Link href="/privacy" className="hover:text-white/70">
          Privacy
        </Link>
        {' · '}
        <Link href="/terms" className="hover:text-white/70">
          Terms
        </Link>
        {' · '}© {new Date().getFullYear()} MOJO APARTMENTS
      </footer>
    </div>
  )
}
