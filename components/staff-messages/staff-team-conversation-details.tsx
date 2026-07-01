'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus, Users, X } from 'lucide-react'
import { getStaffTeamConversationDetails } from '@/app/actions/staff-conversation'
import { AddGroupMembersModal } from '@/components/staff-messages/add-group-members-modal'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'
import type { StaffConversationDetails } from '@/lib/data/staff-conversations'

interface StaffTeamConversationDetailsProps {
  conversationId: string
  open: boolean
  onClose: () => void
  canManageGroupMembers?: boolean
  hotelStaff?: { id: string; name: string; role: string }[]
  onMembersChanged?: () => void
}

function roleLabel(role: string) {
  if (role === 'owner') return 'Property owner'
  if (role === 'manager') return 'Manager'
  if (role === 'receptionist') return 'Receptionist'
  if (role === 'technician') return 'Technician'
  return role
}

function formatCreatedAt(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function StaffTeamConversationDetails({
  conversationId,
  open,
  onClose,
  canManageGroupMembers = false,
  hotelStaff = [],
  onMembersChanged,
}: StaffTeamConversationDetailsProps) {
  const [details, setDetails] = useState<StaffConversationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addMembersOpen, setAddMembersOpen] = useState(false)

  const loadDetails = useCallback(() => {
    setLoading(true)
    setError(null)

    return getStaffTeamConversationDetails(conversationId).then((result) => {
      if (result.success && result.data) {
        setDetails(result.data)
      } else {
        setDetails(null)
        setError(!result.success ? (result.error ?? 'Could not load details.') : 'Could not load details.')
      }
      setLoading(false)
    })
  }, [conversationId])

  useEffect(() => {
    if (!open) return
    void loadDetails()
  }, [open, loadDetails])

  useEffect(() => {
    if (!open) setAddMembersOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isGroup = details?.conversationType === 'group'
  const createdLabel = formatCreatedAt(details?.createdAt ?? null)
  const existingMemberIds = details?.members.map((m) => m.id) ?? []
  const canAddMembers =
    canManageGroupMembers &&
    isGroup &&
    details != null &&
    hotelStaff.some((s) => !existingMemberIds.includes(s.id))

  return (
    <>
    <div className="staff-messenger__details" role="dialog" aria-label="Conversation details">
      <button
        type="button"
        className="staff-messenger__details-backdrop"
        aria-label="Close conversation details"
        onClick={onClose}
      />
      <div className="staff-messenger__details-panel">
        <header className="staff-messenger__details-header">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isGroup ? 'Group chat' : 'Direct message'}
            </p>
            <h2 className="truncate text-base font-semibold text-foreground">
              {details?.name ?? 'Conversation'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="staff-messenger__icon-btn"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="staff-messenger__details-body">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-purple)]" />
              <p className="text-sm">Loading details…</p>
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : details ? (
            <>
              <div className="staff-messenger__details-summary">
                <MessengerAvatar
                  name={details.name}
                  size="lg"
                  variant={isGroup ? 'group' : 'person'}
                  imageUrl={
                    !isGroup
                      ? (details.members.find((m) => !m.isSelf)?.avatarUrl ?? null)
                      : null
                  }
                  className="!h-14 !w-14"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{details.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {isGroup
                      ? `${details.memberCount} members`
                      : 'One-to-one team chat'}
                  </p>
                  {createdLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">Created {createdLabel}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-[var(--brand-purple)]" aria-hidden />
                    <h3 className="text-sm font-semibold text-foreground">
                      {isGroup ? 'Members' : 'Participants'}
                    </h3>
                  </div>
                  {canAddMembers && (
                    <button
                      type="button"
                      onClick={() => setAddMembersOpen(true)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-purple)] hover:bg-secondary"
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden />
                      Add members
                    </button>
                  )}
                </div>
                <ul className="staff-messenger__details-members">
                  {details.members.map((member) => (
                    <li key={member.id} className="staff-messenger__details-member">
                      <MessengerAvatar
                        name={member.name}
                        imageUrl={member.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.name}
                          {member.isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs capitalize text-muted-foreground">
                          {roleLabel(member.role)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>

      {addMembersOpen && details && (
        <AddGroupMembersModal
          conversationId={conversationId}
          conversationName={details.name}
          existingMemberIds={existingMemberIds}
          hotelStaff={hotelStaff}
          onClose={() => setAddMembersOpen(false)}
          onAdded={() => {
            void loadDetails()
            onMembersChanged?.()
          }}
        />
      )}
    </>
  )
}
