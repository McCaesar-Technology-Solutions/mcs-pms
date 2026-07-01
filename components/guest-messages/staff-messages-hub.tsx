'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GuestMessagesInbox } from '@/components/guest-messages/guest-messages-inbox'
import { StaffTeamInbox } from '@/components/staff-messages/staff-team-inbox'
import type { GuestConversationListItem } from '@/lib/data/guest-conversations'
import type { StaffConversationListItem } from '@/lib/data/staff-conversations'

type MessagesTab = 'guests' | 'team'

interface StaffMessagesHubProps {
  guestConversations: GuestConversationListItem[]
  staffConversations: StaffConversationListItem[]
  hotelStaff: { id: string; name: string; role: string }[]
  currentUserId: string
  basePath: string
  reservationsHref: string
  canManageGroupMembers?: boolean
}

export function StaffMessagesHub({
  guestConversations,
  staffConversations,
  hotelStaff,
  currentUserId,
  basePath,
  reservationsHref,
  canManageGroupMembers = false,
}: StaffMessagesHubProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: MessagesTab = tabParam === 'team' ? 'team' : 'guests'
  const guestParamId = searchParams.get('conversation')
  const teamParamId = searchParams.get('team')

  const selectedGuestId = useMemo(() => {
    if (guestParamId && guestConversations.some((c) => c.id === guestParamId)) return guestParamId
    const firstUnread = guestConversations.find((c) => c.unread)
    if (firstUnread) return firstUnread.id
    return guestConversations[0]?.id ?? null
  }, [guestConversations, guestParamId])

  const selectedTeamId = useMemo(() => {
    if (teamParamId && staffConversations.some((c) => c.id === teamParamId)) return teamParamId
    const firstUnread = staffConversations.find((c) => c.unread)
    if (firstUnread) return firstUnread.id
    return staffConversations[0]?.id ?? null
  }, [staffConversations, teamParamId])

  function setTab(next: MessagesTab) {
    const params = new URLSearchParams()
    params.set('tab', next)
    router.replace(`${basePath}?${params.toString()}`, { scroll: false })
  }

  function onSelectGuest(id: string) {
    router.replace(`${basePath}?tab=guests&conversation=${id}`, { scroll: false })
  }

  function onSelectTeam(id: string) {
    router.replace(`${basePath}?tab=team&team=${id}`, { scroll: false })
  }

  function onBackGuest() {
    router.replace(`${basePath}?tab=guests`, { scroll: false })
  }

  function onBackTeam() {
    router.replace(`${basePath}?tab=team`, { scroll: false })
  }

  const guestUnread = guestConversations.filter((c) => c.unread).length
  const teamUnread = staffConversations.filter((c) => c.unread).length

  return (
    <div className="staff-messages-hub">
      <div className="staff-messages-hub__tabs" role="tablist" aria-label="Message channels">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guests'}
          className={`staff-messages-hub__tab ${tab === 'guests' ? 'staff-messages-hub__tab--active' : ''}`}
          onClick={() => setTab('guests')}
        >
          Guests
          {guestUnread > 0 && <span className="staff-messages-hub__badge">{guestUnread}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'team'}
          className={`staff-messages-hub__tab ${tab === 'team' ? 'staff-messages-hub__tab--active' : ''}`}
          onClick={() => setTab('team')}
        >
          Team
          {teamUnread > 0 && <span className="staff-messages-hub__badge">{teamUnread}</span>}
        </button>
      </div>

      {tab === 'guests' ? (
        <GuestMessagesInbox
          conversations={guestConversations}
          selectedId={selectedGuestId}
          onSelect={onSelectGuest}
          onBack={onBackGuest}
          reservationsHref={reservationsHref}
        />
      ) : (
        <StaffTeamInbox
          conversations={staffConversations}
          selectedId={selectedTeamId}
          onSelect={onSelectTeam}
          onBack={onBackTeam}
          hotelStaff={hotelStaff}
          currentUserId={currentUserId}
          onConversationCreated={(id) => onSelectTeam(id)}
          canManageGroupMembers={canManageGroupMembers}
        />
      )}
    </div>
  )
}
