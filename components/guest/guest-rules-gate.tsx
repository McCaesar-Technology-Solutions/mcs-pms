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
    <div className="min-h-dvh bg-[#22124C] px-6 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-center font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#D4A62E]">
          MOJO APARTMENTS
        </p>
        <p className="mt-3 text-center text-lg text-white/90">{hotelName}</p>
        <h1 className="mt-6 text-center text-xl font-semibold">Rules &amp; regulations</h1>
        <p className="mt-2 text-center text-sm text-white/70">
          Please read the following house rules. You must agree before accessing the guest portal.
        </p>

        <ol className="mt-8 space-y-4 rounded-2xl border border-white/15 bg-white/5 p-5">
          {rules.map((rule, index) => (
            <li key={rule.id} className="flex gap-3 text-sm leading-relaxed text-white/90">
              <span className="mt-0.5 shrink-0 font-semibold text-[#D4A62E]">{index + 1}.</span>
              <span>{rule.ruleText}</span>
            </li>
          ))}
        </ol>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/5 p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[#D4A62E]"
          />
          <span className="text-sm text-white/90">
            I have read and agree to the rules and regulations of {hotelName}. I understand that
            failure to comply may result in removal from the property.
          </span>
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!agreed || loading}
          className="mt-6 w-full rounded-xl bg-[#3C216C] py-4 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Continuing…' : 'I agree — continue'}
        </button>
      </div>
    </div>
  )
}
