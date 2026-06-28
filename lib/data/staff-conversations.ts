import { createAdminClient } from '@/lib/supabase/admin'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'

export interface StaffConversationListItem {
  id: string
  conversationType: 'dm' | 'group'
  name: string
  avatarUrl: string | null
  memberNames: string[]
  lastMessageBody: string | null
  lastMessageAt: string | null
  lastAuthorName: string | null
  unread: boolean
}

export interface StaffConversationMessage {
  id: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  body: string
  createdAt: string
  isOwn: boolean
}

function dmDisplayName(
  conversation: { conversation_type: string; name: string | null },
  memberNames: string[],
  memberIds: string[],
  currentUserId: string,
): string {
  if (conversation.conversation_type === 'group' && conversation.name) {
    return conversation.name
  }
  const otherIndex = memberIds.findIndex((id) => id !== currentUserId)
  return memberNames[otherIndex] ?? 'Team member'
}

export async function loadStaffConversations(
  hotelId: string,
  currentUserId: string,
): Promise<StaffConversationListItem[]> {
  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('staff_conversation_members')
    .select('conversation_id, last_read_at')
    .eq('profile_id', currentUserId)

  if (!memberships?.length) return []

  const convIds = memberships.map((m) => m.conversation_id)
  const readMap = new Map(memberships.map((m) => [m.conversation_id, m.last_read_at]))

  const { data: conversations } = await admin
    .from('staff_conversations')
    .select('id, conversation_type, name, updated_at')
    .eq('hotel_id', hotelId)
    .in('id', convIds)
    .order('updated_at', { ascending: false })

  if (!conversations?.length) return []

  const { data: allMembers } = await admin
    .from('staff_conversation_members')
    .select('conversation_id, profile_id')
    .in('conversation_id', convIds)

  const profileIds = [...new Set((allMembers ?? []).map((m) => m.profile_id))]
  const { data: profiles } = profileIds.length
    ? await admin.from('profiles').select('id, name, profile_image_path').in('id', profileIds)
    : { data: [] as { id: string; name: string; profile_image_path: string | null }[] }

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const avatarById = new Map(
    (profiles ?? []).map((p) => [p.id, profilePhotoPublicUrl(p.profile_image_path)]),
  )

  const membersByConv = new Map<string, { profile_id: string; name: string }[]>()
  for (const m of allMembers ?? []) {
    const list = membersByConv.get(m.conversation_id) ?? []
    list.push({ profile_id: m.profile_id, name: nameById.get(m.profile_id) ?? 'Staff' })
    membersByConv.set(m.conversation_id, list)
  }

  const { data: latestMessages } = await admin
    .from('staff_conversation_messages')
    .select('conversation_id, body, created_at, author_id')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  const latestByConv = new Map<
    string,
    { body: string; created_at: string; author_id: string; authorName: string | null }
  >()
  for (const m of latestMessages ?? []) {
    if (!latestByConv.has(m.conversation_id)) {
      latestByConv.set(m.conversation_id, {
        body: m.body,
        created_at: m.created_at ?? new Date(0).toISOString(),
        author_id: m.author_id,
        authorName: nameById.get(m.author_id) ?? null,
      })
    }
  }

  return conversations.map((c) => {
    const members = membersByConv.get(c.id) ?? []
    const latest = latestByConv.get(c.id)
    const lastAt = latest?.created_at ?? c.updated_at ?? null
    const lastRead = readMap.get(c.id)
    const unread =
      latest != null &&
      latest.author_id !== currentUserId &&
      (!lastRead || (lastAt !== null && lastAt > lastRead))

    const otherMemberId =
      c.conversation_type === 'dm'
        ? members.find((m) => m.profile_id !== currentUserId)?.profile_id
        : null

    return {
      id: c.id,
      conversationType: c.conversation_type as 'dm' | 'group',
      name: dmDisplayName(
        c,
        members.map((m) => m.name),
        members.map((m) => m.profile_id),
        currentUserId,
      ),
      avatarUrl: otherMemberId ? (avatarById.get(otherMemberId) ?? null) : null,
      memberNames: members.map((m) => m.name),
      lastMessageBody: latest?.body ?? null,
      lastMessageAt: lastAt,
      lastAuthorName: latest?.authorName ?? null,
      unread,
    }
  })
}

export async function loadStaffConversationMessages(
  conversationId: string,
  currentUserId: string,
): Promise<StaffConversationMessage[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('staff_conversation_messages')
    .select('id, author_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200)

  const authorIds = [...new Set((data ?? []).map((m) => m.author_id))]
  const { data: profiles } = authorIds.length
    ? await admin.from('profiles').select('id, name, profile_image_path').in('id', authorIds)
    : { data: [] as { id: string; name: string; profile_image_path: string | null }[] }
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const avatarById = new Map(
    (profiles ?? []).map((p) => [p.id, profilePhotoPublicUrl(p.profile_image_path)]),
  )

  return (data ?? []).map((m) => ({
    id: m.id,
    authorId: m.author_id,
    authorName: nameById.get(m.author_id) ?? 'Staff',
    authorAvatarUrl: avatarById.get(m.author_id) ?? null,
    body: m.body,
    createdAt: m.created_at ?? new Date().toISOString(),
    isOwn: m.author_id === currentUserId,
  }))
}

export async function countUnreadStaffConversations(
  hotelId: string,
  currentUserId: string,
): Promise<number> {
  const items = await loadStaffConversations(hotelId, currentUserId)
  return items.filter((i) => i.unread).length
}
