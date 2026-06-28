'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptGuestRulesForSession, acceptPropertyRulesBySlug } from '@/app/actions/guest-rules'
import type { GuestRuleRow } from '@/lib/data/guest-rules'

interface GuestRulesGateProps {
  hotelName: string
  rules: GuestRuleRow[]
  mode: 'join' | 'portal'
  slug?: string
}

export function GuestRulesGate({ hotelName, rules, mode, slug }: GuestRulesGateProps) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!agreed) return
    setLoading(true)
    setError(null)

    const result =
      mode === 'join' && slug
        ? await acceptPropertyRulesBySlug(slug)
        : await acceptGuestRulesForSession()

    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }

    router.refresh()
  }

  return (
    <div className="guest-auth-shell">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="text-center">
          <p className="guest-auth-brand">MOJO APARTMENTS</p>
          <p className="mt-2 text-lg">{hotelName}</p>
        </div>

        <div>
          <h1 className="text-center text-lg font-semibold">House rules</h1>
          <p className="mt-2 text-center text-sm leading-relaxed guest-text-muted">
            Quick read before you continue. You agreed to follow these during your stay.
          </p>
        </div>

        <ol className="guest-portal-card max-h-[50dvh] space-y-3 overflow-y-auto">
          {rules.map((rule, index) => (
            <li key={rule.id} className="flex gap-3 text-sm leading-relaxed">
              <span className="shrink-0 font-semibold text-[var(--brand-gold-dark)]">{index + 1}.</span>
              <span>{rule.ruleText}</span>
            </li>
          ))}
        </ol>

        <label className="guest-portal-card flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-gold)]"
          />
          <span className="text-sm leading-relaxed">
            I agree to the rules for {hotelName}.
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!agreed || loading}
          className="guest-btn guest-btn-primary w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Continuing…' : 'Continue to portal'}
        </button>
      </div>
    </div>
  )
}
