'use client'

import { useMemo, useState, useTransition } from 'react'
import { Users } from 'lucide-react'
import {
  createOrUpdateStaffAccess,
  setAccessPolicyPoints,
  updateStaffAccessStatusAction,
} from '@/app/actions/access-control'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
import type {
  AccessCredentialRow,
  AccessPointRow,
  AccessPolicyRow,
  StaffPersonType,
} from '@/lib/access/types'

type Props = {
  hotelId: string
  policies: AccessPolicyRow[]
  points: AccessPointRow[]
  staffCredentials: AccessCredentialRow[]
  canCreateOwnerTypes: boolean
}

const STAFF_TYPES: Array<{ value: StaffPersonType; label: string; ownerOnly?: boolean }> = [
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'receptionist', label: 'Reception' },
  { value: 'security', label: 'Security' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other_staff', label: 'Other staff' },
  { value: 'manager', label: 'Manager', ownerOnly: true },
  { value: 'owner', label: 'Owner', ownerOnly: true },
  { value: 'technical_admin', label: 'Technical admin', ownerOnly: true },
]

function defaultValidRange() {
  const from = new Date()
  const to = new Date()
  to.setFullYear(to.getFullYear() + 2)
  return {
    validFrom: from.toISOString().slice(0, 10),
    validTo: to.toISOString().slice(0, 10),
  }
}

export function StaffAccessPanel({
  hotelId,
  policies,
  points,
  staffCredentials,
  canCreateOwnerTypes,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const range = useMemo(() => defaultValidRange(), [])
  const [name, setName] = useState('')
  const [personType, setPersonType] = useState<StaffPersonType>('housekeeping')
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? '')
  const [validFrom, setValidFrom] = useState(range.validFrom)
  const [validTo, setValidTo] = useState(range.validTo)
  const [editingPolicyId, setEditingPolicyId] = useState(policies[0]?.id ?? '')
  const [selectedPoints, setSelectedPoints] = useState<string[]>(
    () => policies[0]?.point_ids ?? [],
  )

  const typeOptions = STAFF_TYPES.filter((t) => canCreateOwnerTypes || !t.ownerOnly)
  const activePoints = points.filter((p) => p.is_active)

  function run(action: () => Promise<void>) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Staff physical access</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Separate from PMS logins. Reception cannot see or manage these records.
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card-body space-y-4">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const result = await createOrUpdateStaffAccess({
                  hotelId,
                  displayName: name,
                  personType,
                  accessPolicyId: policyId,
                  validFrom,
                  validTo,
                })
                if (!result.success) {
                  setError(result.error)
                  return
                }
                setName('')
                setMessage('Staff access queued for sync.')
              })
            }}
          >
            <FormField label="Name" htmlFor="staff-access-name">
              <input
                id="staff-access-name"
                className={APP_FIELD_CLASS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Staff type" htmlFor="staff-access-type">
              <select
                id="staff-access-type"
                className={APP_FIELD_CLASS}
                value={personType}
                onChange={(e) => setPersonType(e.target.value as StaffPersonType)}
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Access policy" htmlFor="staff-access-policy">
              <select
                id="staff-access-policy"
                className={APP_FIELD_CLASS}
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                required
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {!p.assignable_by_manager ? ' (owner)' : ''}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Valid from" htmlFor="staff-access-from">
              <input
                id="staff-access-from"
                type="date"
                className={APP_FIELD_CLASS}
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Valid to" htmlFor="staff-access-to">
              <input
                id="staff-access-to"
                type="date"
                className={APP_FIELD_CLASS}
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                required
              />
            </FormField>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="app-btn app-btn-primary"
                disabled={pending || !name.trim() || !policyId}
              >
                Create staff access
              </button>
            </div>
          </form>

          {staffCredentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff credentials yet.</p>
          ) : (
            <ul className="space-y-2">
              {staffCredentials.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.person_type} · {c.policy_name ?? 'no policy'} · {c.status} /{' '}
                      {c.sync_status}
                      {c.staff_status ? ` · ${c.staff_status}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="app-btn app-btn-secondary text-xs"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await updateStaffAccessStatusAction({
                            hotelId,
                            credentialId: c.id,
                            staffStatus: 'suspended',
                          })
                          if (!result.success) setError(result.error)
                          else setMessage(`Suspended ${c.display_name}.`)
                        })
                      }
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      className="app-btn app-btn-ghost text-xs"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await updateStaffAccessStatusAction({
                            hotelId,
                            credentialId: c.id,
                            staffStatus: 'terminated',
                          })
                          if (!result.success) setError(result.error)
                          else setMessage(`Terminated access for ${c.display_name}.`)
                        })
                      }
                    >
                      Terminate
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h3 className="text-lg font-semibold text-foreground">Staff access policies</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Map which doors each policy unlocks. Guests still get room + shared + gym from door
            zones.
          </p>
        </div>
        <div className="surface-card-body space-y-3">
          <FormField label="Policy" htmlFor="policy-edit">
            <select
              id="policy-edit"
              className={APP_FIELD_CLASS}
              value={editingPolicyId}
              onChange={(e) => {
                const id = e.target.value
                setEditingPolicyId(id)
                setSelectedPoints(policies.find((p) => p.id === id)?.point_ids ?? [])
              }}
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({(p.point_ids ?? []).length} doors)
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid gap-2 sm:grid-cols-2">
            {activePoints.map((p) => {
              const checked = selectedPoints.includes(p.id)
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedPoints((prev) =>
                        checked ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                      )
                    }}
                  />
                  <span>
                    {p.label}{' '}
                    <span className="text-muted-foreground">
                      ({p.zone}
                      {p.room_number ? ` · ${p.room_number}` : ''})
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          <button
            type="button"
            className="app-btn app-btn-primary"
            disabled={pending || !editingPolicyId}
            onClick={() =>
              run(async () => {
                const result = await setAccessPolicyPoints({
                  hotelId,
                  policyId: editingPolicyId,
                  accessPointIds: selectedPoints,
                })
                if (!result.success) setError(result.error)
                else setMessage('Policy doors saved.')
              })
            }
          >
            Save policy doors
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
    </div>
  )
}
