'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users, X } from 'lucide-react'
import { getStaffTeamConversationDetails } from '@/app/actions/staff-conversation'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'
import type { StaffConversationDetails } from '@/lib/data/staff-conversations'

interface StaffTeamConversationDetailsProps {
  conversationId: string
  open: boolean
  onClose: () => void
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
}: StaffTeamConversationDetailsProps) {
  const [details, setDetails] = useState<StaffConversationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void getStaffTeamConversationDetails(conversationId).then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        setDetails(result.data)
      } else {
        setDetails(null)
        setError(!result.success ? (result.error ?? 'Could not load details.') : 'Could not load details.')
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [conversationId, open])

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

  return (
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
                <div className="mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[var(--brand-purple)]" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">
                    {isGroup ? 'Members' : 'Participants'}
                  </h3>
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
  )
}
