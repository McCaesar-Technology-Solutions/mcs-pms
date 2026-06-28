'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { StaffTeamInbox } from '@/components/staff-messages/staff-team-inbox'
import type { StaffConversationListItem } from '@/lib/data/staff-conversations'

interface TechnicianMessagesClientProps {
  conversations: StaffConversationListItem[]
  hotelStaff: { id: string; name: string; role: string }[]
  currentUserId: string
}

export function TechnicianMessagesClient({
  conversations,
  hotelStaff,
  currentUserId,
}: TechnicianMessagesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramId = searchParams.get('team')

  const selectedId = useMemo(() => {
    if (paramId && conversations.some((c) => c.id === paramId)) return paramId
    const firstUnread = conversations.find((c) => c.unread)
    if (firstUnread) return firstUnread.id
    return conversations[0]?.id ?? null
  }, [conversations, paramId])

  return (
    <StaffTeamInbox
      conversations={conversations}
      selectedId={selectedId}
      onSelect={(id) => router.replace(`/technician/messages?team=${id}`, { scroll: false })}
      onBack={() => router.replace('/technician/messages', { scroll: false })}
      hotelStaff={hotelStaff}
      currentUserId={currentUserId}
      onConversationCreated={(id) =>
        router.replace(`/technician/messages?team=${id}`, { scroll: false })
      }
    />
  )
}
