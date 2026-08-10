'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ChevronDown, MoreHorizontal, Shield, Users } from 'lucide-react'
import { AccessFeedback } from '@/components/dashboard/access-feedback'
import { HeaderDropdownPanel } from '@/components/dashboard/header-dropdown-panel'
import {
  assignAccessCard,
  createOrUpdateStaffAccess,
  retryAccessCredential,
  setAccessPolicyPoints,
  startEnrollmentCapture,
  updateStaffAccessStatusAction,
} from '@/app/actions/access-control'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type {
  AccessCredentialRow,
  AccessPointRow,
  AccessPolicyRow,
  StaffPersonType,
} from '@/lib/access/types'
import type { AccessLinkableProfile } from '@/lib/data/access-control'

type Props = {
  hotelId: string
  policies: AccessPolicyRow[]
  points: AccessPointRow[]
  staffCredentials: AccessCredentialRow[]
  linkableProfiles?: AccessLinkableProfile[]
  hasEnrollmentStation?: boolean
  canCreateOwnerTypes: boolean
}

type CaptureKind = 'card' | 'face' | 'fingerprint'

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

function policyDoorCount(policy: AccessPolicyRow | undefined) {
  return policy?.point_ids?.length ?? 0
}

function firstPolicyWithDoors(policies: AccessPolicyRow[]) {
  return policies.find((p) => policyDoorCount(p) > 0)?.id ?? policies[0]?.id ?? ''
}

function staffSyncChip(c: AccessCredentialRow): { label: string; className: string } {
  if (c.staff_status === 'terminated' || c.status === 'revoked') {
    return { label: 'Terminated', className: 'bg-muted text-muted-foreground' }
  }
  if (c.staff_status === 'suspended' || c.staff_status === 'on_leave') {
    return {
      label: c.staff_status === 'on_leave' ? 'On leave' : 'Suspended',
      className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    }
  }
  if (c.status === 'error' || c.sync_status === 'failed') {
    return { label: 'Error', className: 'bg-destructive/15 text-destructive' }
  }
  if (c.sync_status === 'pending' || c.status === 'pending' || c.status === 'revoking') {
    return {
      label: 'Pending',
      className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    }
  }
  return {
    label: 'Active',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  }
}

export function StaffAccessPanel({
  hotelId,
  policies,
  points,
  staffCredentials,
  linkableProfiles = [],
  hasEnrollmentStation = false,
  canCreateOwnerTypes,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const range = useMemo(() => defaultValidRange(), [])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [personType, setPersonType] = useState<StaffPersonType>('housekeeping')
  const [policyId, setPolicyId] = useState(() => firstPolicyWithDoors(policies))
  const [profileId, setProfileId] = useState('')
  const [validFrom, setValidFrom] = useState(range.validFrom)
  const [validTo, setValidTo] = useState(range.validTo)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingPolicyId, setEditingPolicyId] = useState(policies[0]?.id ?? '')
  const [selectedPoints, setSelectedPoints] = useState<string[]>(
    () => policies[0]?.point_ids ?? [],
  )
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({})
  const [enrollMenuId, setEnrollMenuId] = useState<string | null>(null)
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null)
  const enrollAnchorRef = useRef<HTMLElement | null>(null)
  const moreAnchorRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!policyId && policies[0]?.id) setPolicyId(firstPolicyWithDoors(policies))
  }, [policies, policyId])

  useEffect(() => {
    if (!editingPolicyId && policies[0]?.id) {
      setEditingPolicyId(policies[0].id)
      setSelectedPoints(policies[0].point_ids ?? [])
    }
  }, [policies, editingPolicyId])

  const typeOptions = STAFF_TYPES.filter((t) => canCreateOwnerTypes || !t.ownerOnly)
  const activePoints = points.filter((p) => p.is_active)
  const selectedPolicy = policies.find((p) => p.id === policyId)
  const selectedDoorCount = policyDoorCount(selectedPolicy)
  const datesOk = Boolean(validFrom && validTo && validFrom <= validTo)
  const anyPolicyHasDoors = policies.some((p) => policyDoorCount(p) > 0)

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

  function resetCreateForm() {
    const next = defaultValidRange()
    setName('')
    setProfileId('')
    setPersonType('housekeeping')
    setPolicyId(firstPolicyWithDoors(policies))
    setValidFrom(next.validFrom)
    setValidTo(next.validTo)
    setFormError(null)
  }

  function openCreate() {
    resetCreateForm()
    setCreating(true)
  }

  function onProfileChange(id: string) {
    setProfileId(id)
    if (!id) return
    const profile = linkableProfiles.find((p) => p.id === id)
    if (profile && !name.trim()) setName(profile.name)
  }

  function queueEnroll(credentialId: string, displayName: string, capture: CaptureKind) {
    setEnrollMenuId(null)
    run(async () => {
      const result = await startEnrollmentCapture({
        hotelId,
        credentialId,
        capture,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      if (capture === 'card') setMessage(`Card enroll started for ${displayName}.`)
      else if (capture === 'face') setMessage(`Face enroll started for ${displayName}.`)
      else setMessage(`Fingerprint enroll started for ${displayName}.`)
    })
  }

  function submitCreate() {
    setFormError(null)
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!policyId) {
      setFormError('Choose an access policy.')
      return
    }
    if (selectedDoorCount === 0) {
      setFormError('This policy has no door rights. Save policy door rights first, then try again.')
      return
    }
    if (!datesOk) {
      setFormError('Valid from must be on or before valid to.')
      return
    }
    run(async () => {
      const result = await createOrUpdateStaffAccess({
        hotelId,
        displayName: name,
        personType,
        accessPolicyId: policyId,
        profileId: profileId || null,
        validFrom,
        validTo,
      })
      if (!result.success) {
        setFormError(result.error)
        return
      }
      setCreating(false)
      resetCreateForm()
      setMessage('Staff access queued for sync.')
    })
  }

  return (
    <div className="space-y-6">
      {/* 1) Policy door rights first */}
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Policy door rights</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Which doors this staff group may open. Do this before adding people. Guests still get
                room + shared + gym from physical door zones
                {canCreateOwnerTypes ? ' (Setup).' : ' (owner Setup).'}
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card-body space-y-3">
          {activePoints.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {canCreateOwnerTypes
                ? 'No physical doors yet. Open Setup → Physical doors, then return here.'
                : 'No physical doors yet. The owner must finish Setup before staff policies can be mapped.'}
            </p>
          ) : null}
          <FormField label="Staff group (policy)" htmlFor="policy-edit">
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
                  {p.name} — {(p.point_ids ?? []).length} door
                  {(p.point_ids ?? []).length === 1 ? '' : 's'}
                  {!p.assignable_by_manager ? ' (owner-only assign)' : ''}
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
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-shadow ${
                    checked
                      ? 'bg-primary/5 shadow-elevation-1 ring-1 ring-primary/20'
                      : 'bg-card shadow-elevation-1'
                  }`}
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
            disabled={pending || !editingPolicyId || activePoints.length === 0}
            onClick={() =>
              run(async () => {
                const result = await setAccessPolicyPoints({
                  hotelId,
                  policyId: editingPolicyId,
                  accessPointIds: selectedPoints,
                })
                if (!result.success) setError(result.error)
                else setMessage('Policy door rights saved.')
              })
            }
          >
            Save policy door rights
          </button>
        </div>
      </div>

      {/* 2) Staff people */}
      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Staff badges</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Physical access only — separate from PMS logins. Reception cannot see these.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="app-btn app-btn-primary h-11 shrink-0"
              disabled={pending || !anyPolicyHasDoors}
              title={
                anyPolicyHasDoors
                  ? undefined
                  : 'Save policy door rights above before adding staff'
              }
              onClick={openCreate}
            >
              Add staff
            </button>
          </div>
        </div>
        <div className="surface-card-body space-y-3">
          {!anyPolicyHasDoors ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Save policy door rights above before creating staff access.
            </p>
          ) : null}

          {staffCredentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff badges yet. Add someone after their policy has doors.
            </p>
          ) : (
            <ul className="soft-list">
              {staffCredentials.map((c) => {
                const inactive =
                  c.staff_status === 'suspended' ||
                  c.staff_status === 'terminated' ||
                  c.staff_status === 'on_leave' ||
                  c.status === 'revoked'
                const chip = staffSyncChip(c)
                return (
                  <li
                    key={c.id}
                    className="soft-list-item flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{c.display_name}</p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.className}`}
                        >
                          {chip.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.person_type?.replace(/_/g, ' ')} · {c.policy_name ?? 'no policy'}
                        {c.card_no ? ` · Card ${c.card_no}` : ''}
                        {c.has_face ? ' · Face' : ''}
                        {c.has_fingerprint ? ' · Fingerprint' : ''}
                      </p>
                      {c.last_error ? (
                        <p className="mt-1 text-xs text-destructive">{c.last_error}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!inactive ? (
                        <button
                          type="button"
                          className="app-btn app-btn-primary h-11 min-w-[7.5rem] text-sm"
                          disabled={pending || !hasEnrollmentStation}
                          aria-expanded={enrollMenuId === c.id}
                          title={
                            hasEnrollmentStation
                              ? 'Enroll at the station'
                              : canCreateOwnerTypes
                                ? 'Save an enrollment station under Setup first'
                                : 'Ask the owner to save an enrollment station under Setup'
                          }
                          onClick={(e) => {
                            const next = enrollMenuId === c.id ? null : c.id
                            enrollAnchorRef.current = e.currentTarget
                            setMoreMenuId(null)
                            setEnrollMenuId(next)
                          }}
                        >
                          Enroll
                          <ChevronDown className="ml-1 inline h-4 w-4" aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="app-btn app-btn-primary h-11 text-sm"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const result = await updateStaffAccessStatusAction({
                                hotelId,
                                credentialId: c.id,
                                staffStatus: 'active',
                              })
                              if (!result.success) setError(result.error)
                              else setMessage(`Reactivated ${c.display_name} — sync queued.`)
                            })
                          }
                        >
                          Resume
                        </button>
                      )}

                      <button
                        type="button"
                        className="app-btn app-btn-ghost h-11 w-11 px-0"
                        aria-label={`More actions for ${c.display_name}`}
                        aria-expanded={moreMenuId === c.id}
                        disabled={pending}
                        onClick={(e) => {
                          const next = moreMenuId === c.id ? null : c.id
                          moreAnchorRef.current = e.currentTarget
                          setEnrollMenuId(null)
                          setMoreMenuId(next)
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {creating ? (
        <CenteredModal
          open
          onClose={() => {
            setCreating(false)
            setFormError(null)
          }}
          className="max-w-lg"
          aria-label="Add staff access"
        >
          <ModalHeader
            onClose={() => {
              setCreating(false)
              setFormError(null)
            }}
          >
            <h3 className="text-lg font-semibold text-foreground">Add staff access</h3>
          </ModalHeader>
          <ModalBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose a policy that already has door rights. Enroll at the station after creating.
            </p>
            {linkableProfiles.length > 0 ? (
              <FormField label="Link PMS login (optional)" htmlFor="staff-access-profile">
                <select
                  id="staff-access-profile"
                  className={APP_FIELD_CLASS}
                  value={profileId}
                  onChange={(e) => onProfileChange(e.target.value)}
                >
                  <option value="">No login link</option>
                  {linkableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <FormField label="Name" htmlFor="staff-access-name">
              <input
                id="staff-access-name"
                className={APP_FIELD_CLASS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
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
                {policies.map((p) => {
                  const count = policyDoorCount(p)
                  return (
                    <option key={p.id} value={p.id} disabled={count === 0}>
                      {p.name} — {count} door{count === 1 ? '' : 's'}
                      {count === 0 ? ' (no doors yet)' : ''}
                      {!p.assignable_by_manager ? ' (owner)' : ''}
                    </option>
                  )
                })}
              </select>
              {selectedDoorCount === 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  This policy has no door rights. Close this and save doors under Policy door rights.
                </p>
              ) : null}
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            {!datesOk ? (
              <p className="text-xs text-destructive">Valid from must be on or before valid to.</p>
            ) : null}
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="app-btn app-btn-ghost"
              onClick={() => {
                setCreating(false)
                setFormError(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="app-btn app-btn-primary"
              disabled={
                pending || !name.trim() || !policyId || selectedDoorCount === 0 || !datesOk
              }
              onClick={submitCreate}
            >
              Create & sync
            </button>
          </ModalFooter>
        </CenteredModal>
      ) : null}

      <AccessFeedback error={error} message={message} />

      <HeaderDropdownPanel
        open={Boolean(enrollMenuId)}
        anchorRef={enrollAnchorRef}
        width={176}
        align="end"
        onClose={() => setEnrollMenuId(null)}
        className="access-menu-panel p-1"
      >
        {(() => {
          const c = staffCredentials.find((s) => s.id === enrollMenuId)
          if (!c) return null
          return (
            <>
              {(
                [
                  ['card', `Card${c.card_no ? ' ✓' : ''}`],
                  ['face', `Face${c.has_face ? ' ✓' : ''}`],
                  ['fingerprint', `Fingerprint${c.has_fingerprint ? ' ✓' : ''}`],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-muted/60"
                  disabled={pending || !hasEnrollmentStation}
                  onClick={() => queueEnroll(c.id, c.display_name, kind)}
                >
                  {label}
                </button>
              ))}
            </>
          )
        })()}
      </HeaderDropdownPanel>

      <HeaderDropdownPanel
        open={Boolean(moreMenuId)}
        anchorRef={moreAnchorRef}
        width={256}
        align="end"
        onClose={() => setMoreMenuId(null)}
        className="access-menu-panel space-y-2 p-3"
      >
        {(() => {
          const c = staffCredentials.find((s) => s.id === moreMenuId)
          if (!c) return null
          const inactive =
            c.staff_status === 'suspended' ||
            c.staff_status === 'terminated' ||
            c.staff_status === 'on_leave' ||
            c.status === 'revoked'
          const needsRetry = c.sync_status === 'failed' || c.status === 'error'
          if (!inactive) {
            return (
              <>
                <div className="flex gap-2">
                  <input
                    className="app-field h-9 flex-1 text-xs"
                    placeholder={c.card_no ?? 'Card number'}
                    value={cardDrafts[c.id] ?? ''}
                    onChange={(e) =>
                      setCardDrafts((prev) => ({
                        ...prev,
                        [c.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="app-btn app-btn-secondary h-9 text-xs"
                    disabled={pending || !(cardDrafts[c.id] ?? '').trim()}
                    onClick={() => {
                      setMoreMenuId(null)
                      run(async () => {
                        const result = await assignAccessCard({
                          hotelId,
                          credentialId: c.id,
                          cardNo: (cardDrafts[c.id] ?? '').trim(),
                        })
                        if (!result.success) setError(result.error)
                        else {
                          setCardDrafts((prev) => ({ ...prev, [c.id]: '' }))
                          setMessage(`Card assigned for ${c.display_name}.`)
                        }
                      })
                    }}
                  >
                    Assign
                  </button>
                </div>
                {needsRetry ? (
                  <button
                    type="button"
                    className="app-btn app-btn-secondary h-9 w-full text-xs"
                    disabled={pending}
                    onClick={() => {
                      setMoreMenuId(null)
                      run(async () => {
                        const result = await retryAccessCredential(hotelId, c.id)
                        if (!result.success) setError(result.error)
                        else setMessage(`Re-provision queued for ${c.display_name}.`)
                      })
                    }}
                  >
                    Retry sync
                  </button>
                ) : null}
                <button
                  type="button"
                  className="app-btn app-btn-secondary h-9 w-full text-xs"
                  disabled={pending}
                  onClick={() => {
                    setMoreMenuId(null)
                    run(async () => {
                      const result = await updateStaffAccessStatusAction({
                        hotelId,
                        credentialId: c.id,
                        staffStatus: 'suspended',
                      })
                      if (!result.success) setError(result.error)
                      else setMessage(`Suspended ${c.display_name}.`)
                    })
                  }}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-ghost h-9 w-full text-xs text-destructive"
                  disabled={pending}
                  onClick={() => {
                    setMoreMenuId(null)
                    run(async () => {
                      const result = await updateStaffAccessStatusAction({
                        hotelId,
                        credentialId: c.id,
                        staffStatus: 'terminated',
                      })
                      if (!result.success) setError(result.error)
                      else setMessage(`Terminated access for ${c.display_name}.`)
                    })
                  }}
                >
                  Terminate
                </button>
              </>
            )
          }
          if (needsRetry) {
            return (
              <button
                type="button"
                className="app-btn app-btn-secondary h-9 w-full text-xs"
                disabled={pending}
                onClick={() => {
                  setMoreMenuId(null)
                  run(async () => {
                    const result = await retryAccessCredential(hotelId, c.id)
                    if (!result.success) setError(result.error)
                    else setMessage(`Re-provision queued for ${c.display_name}.`)
                  })
                }}
              >
                Retry sync
              </button>
            )
          }
          return (
            <p className="text-xs text-muted-foreground">Use Resume to restore access.</p>
          )
        })()}
      </HeaderDropdownPanel>
    </div>
  )
}
