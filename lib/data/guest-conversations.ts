import { createAdminClient } from '@/lib/supabase/admin'

export interface GuestConversationListItem {
  id: string
  guestId: string
  guestName: string
  roomNumber: string | null
  lastMessageBody: string | null
  lastMessageAt: string | null
  lastAuthorRole: 'guest' | 'staff' | null
  unread: boolean
}

export async function loadGuestConversations(hotelId: string): Promise<GuestConversationListItem[]> {
  const admin = createAdminClient()
  const { data: conversations } = await admin
    .from('guest_conversations')
    .select('id, guest_id, staff_last_read_at, updated_at, guests(name, room_id, rooms(number))')
    .eq('hotel_id', hotelId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (!conversations?.length) return []

  const ids = conversations.map((c) => c.id)
  const { data: latestMessages } = await admin
    .from('guest_conversation_messages')
    .select('conversation_id, body, author_role, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })

  const latestByConv = new Map<string, { body: string; author_role: string; created_at: string }>()
  for (const m of latestMessages ?? []) {
    if (!latestByConv.has(m.conversation_id)) {
      latestByConv.set(m.conversation_id, {
        body: m.body,
        author_role: m.author_role,
        created_at: m.created_at ?? new Date(0).toISOString(),
      })
    }
  }

  return conversations.map((c) => {
    const guest = c.guests as { name?: string; rooms?: { number?: string } | null } | null
    const latest = latestByConv.get(c.id)
    const lastAt = latest?.created_at ?? c.updated_at ?? null
    const staffRead = c.staff_last_read_at
    const unread =
      latest?.author_role === 'guest' &&
      (!staffRead || (lastAt !== null && lastAt > staffRead))

    return {
      id: c.id,
      guestId: c.guest_id,
      guestName: guest?.name ?? 'Guest',
      roomNumber: guest?.rooms?.number ?? null,
      lastMessageBody: latest?.body ?? null,
      lastMessageAt: lastAt,
      lastAuthorRole: (latest?.author_role as 'guest' | 'staff') ?? null,
      unread,
    }
  })
}

export async function countUnreadGuestConversations(hotelId: string): Promise<number> {
  const items = await loadGuestConversations(hotelId)
  return items.filter((i) => i.unread).length
}
