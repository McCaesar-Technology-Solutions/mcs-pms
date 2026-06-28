'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { GuestMessagesInbox } from '@/components/guest-messages/guest-messages-inbox'
import type { GuestConversationListItem } from '@/lib/data/guest-conversations'

interface GuestMessagesPageClientProps {
  conversations: GuestConversationListItem[]
  basePath: '/manager/messages' | '/receptionist/messages'
}

export function GuestMessagesPageClient({ conversations, basePath }: GuestMessagesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramId = searchParams.get('conversation')

  const selectedId = useMemo(() => {
    if (paramId && conversations.some((c) => c.id === paramId)) return paramId
    const firstUnread = conversations.find((c) => c.unread)
    if (firstUnread) return firstUnread.id
    return conversations[0]?.id ?? null
  }, [conversations, paramId])

  function onSelect(id: string) {
    router.replace(`${basePath}?conversation=${id}`, { scroll: false })
  }

  function onBack() {
    router.replace(basePath, { scroll: false })
  }

  return (
    <GuestMessagesInbox
      conversations={conversations}
      selectedId={selectedId}
      onSelect={onSelect}
      onBack={onBack}
    />
  )
}
