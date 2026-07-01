'use client'

import { Suspense, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Download, Loader2, Mail, MessageCircle, Phone, Plus, Search, ShieldCheck, UserX, X } from 'lucide-react'
import { inviteStaff, revokeInvite, setStaffActive, updateStaffPhone } from '@/app/actions/staff'
import { startStaffDm } from '@/app/actions/staff-conversation'
import { ProfilePhoneEditor } from '@/components/dashboard/profile-phone-editor'
import { MfaSettingsCard } from '@/components/dashboard/mfa-settings-card'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard, staffRef } from '@/lib/export/entity-refs'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import { hasPhoneNumber } from '@/lib/phone'
import { toast } from 'sonner'
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
  receptionist: { label: 'Receptionist', chip: 'bg-teal-100 text-teal-800' },
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

type InviteRole = 'manager' | 'technician' | 'receptionist'

function allowedInviteRoles(role: UserRole): InviteRole[] {
  if (role === 'owner') return ['manager', 'receptionist', 'technician']
  if (role === 'manager') return ['receptionist', 'technician']
  return []
}

function canManageMember(actor: Profile, target: Profile): boolean {
  if (actor.id === target.id) return false
  if (target.role === 'owner') return false
  if (actor.role === 'owner') {
    return target.role === 'manager' || target.role === 'technician' || target.role === 'receptionist'
  }
  if (actor.role === 'manager') {
    return target.role === 'technician' || target.role === 'receptionist'
  }
  return false
}

function inviteLink(token: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/accept-invite?t=${token}`
}

export function StaffManager({ currentProfile, staff, invites }: StaffManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const inviteRoles = allowedInviteRoles(currentProfile.role)
  const canInvite = inviteRoles.length > 0

  const [open, setOpen] = useState(false)
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<InviteRole>(inviteRoles[0] ?? 'technician')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [createdContact, setCreatedContact] = useState<string | null>(null)
  const [deliveryDetail, setDeliveryDetail] = useState<string | null>(null)
  const [deliverySent, setDeliverySent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [chattingId, setChattingId] = useState<string | null>(null)

  const messagesPath =
    currentProfile.role === 'owner' ? '/owner/messages' : '/manager/messages'

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active !== false), [staff])
  const inactiveStaff = useMemo(() => staff.filter((s) => s.is_active === false), [staff])
  const allStaff = useMemo(() => [...activeStaff, ...inactiveStaff], [activeStaff, inactiveStaff])
  const selection = useRowSelection(allStaff, allStaff)

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allStaff
    return allStaff.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.phone ?? '').includes(q) ||
        (m.specialty ?? '').toLowerCase().includes(q) ||
        ROLE_BADGE[m.role].label.toLowerCase().includes(q),
    )
  }, [allStaff, searchQuery])

  const filteredActiveStaff = useMemo(
    () => filteredStaff.filter((s) => s.is_active !== false),
    [filteredStaff],
  )
  const filteredInactiveStaff = useMemo(
    () => filteredStaff.filter((s) => s.is_active === false),
    [filteredStaff],
  )

  function copyStaffRefs() {
    void copyToClipboard(
      selection.selected.map((m) => staffRef(m.id)).join(', '),
      `Copied ${selection.selected.length} staff ref${selection.selected.length === 1 ? '' : 's'}`,
    )
  }

  function copyStaffEmails() {
    const emails = selection.selected.map((m) => m.email?.trim()).filter(Boolean) as string[]
    if (emails.length === 0) {
      toast.error('None of the selected staff have an email on file.')
      return
    }
    void copyToClipboard(
      emails.join(', '),
      `Copied ${emails.length} email${emails.length === 1 ? '' : 's'}`,
    )
  }

  function exportStaffCsv() {
    const header = ['Reference', 'Name', 'Role', 'Email', 'Phone', 'Status']
    const rows = selection.selected.map((m) => [
      staffRef(m.id),
      m.name,
      ROLE_BADGE[m.role].label,
      m.email ?? '',
      m.phone ?? '',
      m.is_active === false ? 'Disabled' : 'Active',
    ])
    downloadCsv(`staff-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selection.selected.length} staff member${selection.selected.length === 1 ? '' : 's'}`)
  }

  const withEmail = selection.selected.filter((m) => m.email?.trim()).length

  function resetModal() {
    setContact('')
    setRole(inviteRoles[0] ?? 'technician')
    setError(null)
    setCreatedToken(null)
    setCreatedContact(null)
    setDeliveryDetail(null)
    setDeliverySent(false)
    setCopied(false)
  }

  const inviteUsesPhone = role === 'technician'

  function openModal() {
    resetModal()
    setOpen(true)
  }

  async function handleInvite() {
    setError(null)
    setSubmitting(true)
    const result = await inviteStaff(contact, role)
    setSubmitting(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (result.data) {
      setCreatedToken(result.data.token)
      setCreatedContact(result.data.phone ?? result.data.email ?? contact)
      setDeliveryDetail(result.data.delivery.detail)
      setDeliverySent(result.data.delivery.sent)
    }
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

  async function handleChat(member: Profile) {
    if (member.id === currentProfile.id) return
    setChattingId(member.id)
    const result = await startStaffDm(member.id)
    setChattingId(null)
    if (result.success && result.data) {
      router.push(`${messagesPath}?tab=team&team=${result.data.conversationId}`)
      return
    }
    if (!result.success) {
      toast.error(result.error ?? 'Could not open chat.')
    }
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
        } ${selection.isSelected(member.id) ? 'ring-2 ring-primary/20' : ''}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BulkSelectCheckbox
            checked={selection.isSelected(member.id)}
            onChange={() => selection.toggle(member.id)}
            aria-label={`Select ${member.name}`}
          />
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
          {!isSelf && (
            <button
              type="button"
              onClick={() => void handleChat(member)}
              disabled={chattingId === member.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3C216C]/10 px-2.5 py-1.5 text-xs font-semibold text-[#3C216C] transition-colors hover:bg-[#3C216C]/20 disabled:opacity-50"
              aria-label={`Message ${member.name}`}
            >
              {chattingId === member.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5" />
              )}
              Chat
            </button>
          )}
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

  const staffReturnPath =
    currentProfile.role === 'owner' ? '/owner/staff' : '/manager/staff'

  return (
    <>
      <BulkActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        ariaLabel="Bulk staff actions"
        actions={[
          { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyStaffRefs },
          {
            key: 'emails',
            label: withEmail > 0 ? `Copy emails (${withEmail})` : 'Copy emails',
            icon: Copy,
            onClick: copyStaffEmails,
            hidden: withEmail === 0,
          },
          { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportStaffCsv },
        ]}
      />
      {currentProfile.role !== 'technician' && (
        <div id="security" className="scroll-mt-24 space-y-6">
          <ProfilePhoneEditor
            initialPhone={currentProfile.phone}
            roleLabel={
              currentProfile.role === 'owner'
                ? 'property owner'
                : currentProfile.role === 'manager'
                  ? 'manager'
                  : 'staff member'
            }
            variant="card"
          />
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Checking sign-in verification…</p>}
          >
            <MfaSettingsCard role={currentProfile.role} returnPath={staffReturnPath} />
          </Suspense>
        </div>
      )}

      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">Team</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredActiveStaff.length} active {filteredActiveStaff.length === 1 ? 'member' : 'members'}
              {filteredInactiveStaff.length > 0 ? ` · ${filteredInactiveStaff.length} disabled` : ''}
              {searchQuery.trim() ? ` · ${filteredStaff.length} shown` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {allStaff.length > 0 && (
              <BulkSelectCheckbox
                checked={selection.allFilteredSelected}
                onChange={selection.toggleAllFiltered}
                aria-label="Select all staff"
                className="mr-1"
              />
            )}
            {canInvite && (
            <Button onClick={openModal} className="bg-[#3C216C] text-white hover:bg-[#4c2a85]">
              <Plus className="mr-1.5 h-4 w-4" />
              Invite staff
            </Button>
            )}
          </div>
        </div>

        <div className="surface-card-header space-y-4">
          <div className="app-search-field">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search staff"
              placeholder="Search by name, email, phone, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="p-4">
          <div className="card-list-tray space-y-3">
            {staff.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No team members yet.
              </p>
            )}
            {staff.length > 0 && filteredStaff.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No staff match your search.
              </p>
            )}
            {filteredActiveStaff.map(renderStaffRow)}
            {filteredInactiveStaff.map(renderStaffRow)}
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
              {invites.map((invite) => {
                const inviteContact =
                  invite.role === 'technician' && invite.phone ? invite.phone : invite.email
                const InviteIcon = invite.role === 'technician' ? Phone : Mail
                return (
                <div
                  key={invite.id}
                  className="elevated-list-item flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#faf8fc] text-[#3C216C]">
                      <InviteIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{inviteContact}</p>
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
              )})}
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
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                  deliverySent
                    ? 'bg-emerald-500/10 text-emerald-900'
                    : 'bg-amber-500/10 text-amber-900'
                }`}
              >
                <Check className="h-4 w-4 shrink-0" />
                {deliveryDetail ?? `Invite created for ${createdContact}.`}
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
                  {deliverySent
                    ? 'Automatic delivery can lag or fail — share this link on WhatsApp or in person if they do not receive it.'
                    : 'Share this link manually (WhatsApp, SMS, or in person).'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                They will set a name and password, then sign in as a {role}.
              </p>
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
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as InviteRole)
                    setContact('')
                    setError(null)
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {inviteRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_BADGE[r].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-contact">
                  {inviteUsesPhone ? 'Phone number' : 'Email'}
                </Label>
                <Input
                  id="invite-contact"
                  type={inviteUsesPhone ? 'tel' : 'email'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={inviteUsesPhone ? '+233 XX XXX XXXX' : 'name@example.com'}
                />
                {inviteUsesPhone && (
                  <p className="text-xs text-muted-foreground">
                    The invite link is sent by SMS (Arkesel) and WhatsApp when Termii is configured.
                  </p>
                )}
                {!inviteUsesPhone && (
                  <p className="text-xs text-muted-foreground">
                    The invite link is sent to their email automatically.
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button
                onClick={handleInvite}
                disabled={submitting || !contact.trim()}
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
