'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Mail, Plus, ShieldCheck, UserX, X } from 'lucide-react'
import { inviteStaff, revokeInvite, setStaffActive, updateStaffPhone } from '@/app/actions/staff'
import { ProfilePhoneEditor } from '@/components/dashboard/profile-phone-editor'
import { hasPhoneNumber } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type { Profile, StaffInvite, UserRole } from '@/types'

interface StaffManagerProps {
  currentProfile: Profile
  staff: Profile[]
  invites: StaffInvite[]
}

const ROLE_BADGE: Record<UserRole, { label: string; chip: string }> = {
  owner: { label: 'Owner', chip: 'bg-[#3C216C] text-white' },
  manager: { label: 'Manager', chip: 'bg-[#D4A62E]/20 text-[#9a7615]' },
  technician: { label: 'Technician', chip: 'bg-slate-100 text-slate-700' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function allowedInviteRoles(role: UserRole): ('manager' | 'technician')[] {
  if (role === 'owner') return ['manager', 'technician']
  if (role === 'manager') return ['technician']
  return []
}

function canManageMember(actor: Profile, target: Profile): boolean {
  if (actor.id === target.id) return false
  if (target.role === 'owner') return false
  if (actor.role === 'owner') return target.role === 'manager' || target.role === 'technician'
  if (actor.role === 'manager') return target.role === 'technician'
  return false
}

function inviteLink(token: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/accept-invite?token=${token}`
}

export function StaffManager({ currentProfile, staff, invites }: StaffManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const inviteRoles = allowedInviteRoles(currentProfile.role)
  const canInvite = inviteRoles.length > 0

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'manager' | 'technician'>(inviteRoles[0] ?? 'technician')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active !== false), [staff])
  const inactiveStaff = useMemo(() => staff.filter((s) => s.is_active === false), [staff])

  function resetModal() {
    setEmail('')
    setRole(inviteRoles[0] ?? 'technician')
    setError(null)
    setCreatedToken(null)
    setCopied(false)
  }

  function openModal() {
    resetModal()
    setOpen(true)
  }

  async function handleInvite() {
    setError(null)
    setSubmitting(true)
    const result = await inviteStaff(email, role)
    setSubmitting(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (result.data) setCreatedToken(result.data.token)
    router.refresh()
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable; ignore
    }
  }

  function handleToggleActive(member: Profile) {
    startTransition(async () => {
      await setStaffActive(member.id, member.is_active === false)
      router.refresh()
    })
  }

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      await revokeInvite(inviteId)
      router.refresh()
    })
  }

  function startPhoneEdit(member: Profile) {
    setEditingPhoneId(member.id)
    setPhoneDraft(member.phone ?? '')
    setPhoneError(null)
  }

  function saveStaffPhone(profileId: string) {
    setPhoneError(null)
    startTransition(async () => {
      const result = await updateStaffPhone(profileId, phoneDraft)
      if (result.success) {
        setEditingPhoneId(null)
        router.refresh()
      } else {
        setPhoneError(result.error ?? 'Could not save.')
      }
    })
  }

  function renderStaffRow(member: Profile) {
    const badge = ROLE_BADGE[member.role]
    const manageable = canManageMember(currentProfile, member)
    const inactive = member.is_active === false
    const isSelf = member.id === currentProfile.id
    const canEditPhone = isSelf || manageable
    const isEditingPhone = editingPhoneId === member.id

    return (
      <div
        key={member.id}
        className={`elevated-list-item flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between ${
          inactive ? 'opacity-60' : ''
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
            {getInitials(member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#111827]">
              {member.name}
              {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(You)</span>}
            </p>
            {isEditingPhone ? (
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder="+233 XX XXX XXXX"
                  className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs sm:max-w-[180px]"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingPhoneId(null)}
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !phoneDraft.trim()}
                    onClick={() => saveStaffPhone(member.id)}
                    className="rounded-lg bg-[#3C216C] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                {phoneError && isEditingPhone && (
                  <p className="text-xs text-destructive">{phoneError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {member.phone ?? (member.specialty ? member.specialty : member.email)}
                </p>
                {canEditPhone && (
                  <button
                    type="button"
                    onClick={() => startPhoneEdit(member)}
                    className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
                  >
                    {hasPhoneNumber(member.phone) ? 'Edit phone' : 'Add phone'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.chip}`}>
            {badge.label}
          </span>
          {inactive && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
              Disabled
            </span>
          )}
          {manageable && (
            <button
              type="button"
              onClick={() => handleToggleActive(member)}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                inactive
                  ? 'bg-[#3C216C]/10 text-[#3C216C] hover:bg-[#3C216C]/20'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              {inactive ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
              {inactive ? 'Reactivate' : 'Disable'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {currentProfile.role !== 'technician' && (
        <ProfilePhoneEditor
          initialPhone={currentProfile.phone}
          roleLabel={currentProfile.role === 'owner' ? 'property owner' : 'manager'}
          variant="card"
        />
      )}

      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">Team</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeStaff.length} active {activeStaff.length === 1 ? 'member' : 'members'}
              {inactiveStaff.length > 0 ? ` · ${inactiveStaff.length} disabled` : ''}
            </p>
          </div>
          {canInvite && (
            <Button onClick={openModal} className="bg-[#3C216C] text-white hover:bg-[#4c2a85]">
              <Plus className="mr-1.5 h-4 w-4" />
              Invite staff
            </Button>
          )}
        </div>

        <div className="p-4">
          <div className="card-list-tray space-y-3">
            {staff.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No team members yet.
              </p>
            )}
            {activeStaff.map(renderStaffRow)}
            {inactiveStaff.map(renderStaffRow)}
          </div>
        </div>
      </div>

      {invites.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="surface-card-header">
            <h3 className="text-lg font-semibold text-[#111827]">Pending invites</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {invites.length} awaiting acceptance
            </p>
          </div>
          <div className="p-4">
            <div className="card-list-tray space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="elevated-list-item flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#faf8fc] text-[#3C216C]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{invite.email}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          ROLE_BADGE[invite.role].chip
                        }`}
                      >
                        {ROLE_BADGE[invite.role].label}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(invite.token)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/70"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(invite.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <CenteredModal
        open={open}
        onClose={() => setOpen(false)}
        className="max-w-md"
        aria-label="Invite staff"
      >
        <ModalHeader onClose={() => setOpen(false)}>
          <h3 className="text-lg font-semibold">Invite staff</h3>
          <p className="modal-panel-subtle text-sm">
            Send a registration link to a new team member.
          </p>
        </ModalHeader>

        {createdToken ? (
          <>
            <ModalBody className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-[#3C216C]/8 px-4 py-3 text-sm font-medium text-[#3C216C]">
                <Check className="h-4 w-4" />
                Invite created. Share this link with {email}.
              </div>
              <div className="space-y-2">
                <Label>Invite link</Label>
                <div className="flex items-center gap-2 rounded-xl surface-inset px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {inviteLink(createdToken)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink(createdToken)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#3C216C] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The link lets them set a name and password, then sign in as a {role}.
                </p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setOpen(false)} className="w-full bg-[#3C216C] text-white">
                Done
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'manager' | 'technician')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {inviteRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_BADGE[r].label}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button
                onClick={handleInvite}
                disabled={submitting || !email.trim()}
                className="w-full bg-[#3C216C] text-white"
              >
                {submitting ? 'Creating invite…' : 'Create invite'}
              </Button>
            </ModalFooter>
          </>
        )}
      </CenteredModal>
    </>
  )
}
