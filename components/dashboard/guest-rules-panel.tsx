'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { addGuestRule, fetchStaffGuestRules, removeGuestRule } from '@/app/actions/guest-rules'
import type { GuestRuleRow } from '@/lib/data/guest-rules'

interface GuestRulesPanelProps {
  hotelId: string
  propertyName: string
  canEdit?: boolean
}

export function GuestRulesPanel({
  hotelId,
  propertyName,
  canEdit = true,
}: GuestRulesPanelProps) {
  const router = useRouter()
  const [rules, setRules] = useState<GuestRuleRow[]>([])
  const [version, setVersion] = useState(1)
  const [newRule, setNewRule] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    fetchStaffGuestRules(hotelId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.success || !result.data) {
        setError(!result.success ? result.error : 'Could not load guest rules.')
        return
      }
      setRules(result.data.rules)
      setVersion(result.data.version)
    })
    return () => {
      cancelled = true
    }
  }, [hotelId])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit || !newRule.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await addGuestRule(hotelId, newRule)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNewRule('')
      router.refresh()
      const refreshed = await fetchStaffGuestRules(hotelId)
      if (refreshed.success && refreshed.data) {
        setRules(refreshed.data.rules)
        setVersion(refreshed.data.version)
      }
    })
  }

  function handleRemove(ruleId: string) {
    if (!canEdit) return
    setError(null)
    startTransition(async () => {
      const result = await removeGuestRule(hotelId, ruleId)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
      const refreshed = await fetchStaffGuestRules(hotelId)
      if (refreshed.success && refreshed.data) {
        setRules(refreshed.data.rules)
        setVersion(refreshed.data.version)
      }
    })
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Guest rules &amp; regulations</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Shown to guests when they scan the QR code for {propertyName}. Changes are logged in
              the activity log for the owner. Version {version}.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-border/60 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading rules…</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule, index) => (
              <li
                key={rule.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-[#FAFDFF] px-4 py-3"
              >
                <p className="text-sm text-foreground">
                  <span className="mr-2 font-semibold text-[#3C216C]">{index + 1}.</span>
                  {rule.ruleText}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(rule.id)}
                    disabled={pending || rules.length <= 1}
                    className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    title="Remove rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <form onSubmit={handleAdd} className="space-y-3">
            <label htmlFor="new-guest-rule" className="block text-sm font-medium text-foreground">
              Add a rule
            </label>
            <textarea
              id="new-guest-rule"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              rows={3}
              placeholder="e.g. Pool hours are 8:00 AM – 8:00 PM. Children must be supervised."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || newRule.trim().length < 5}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4c2a85] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add rule
            </button>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
