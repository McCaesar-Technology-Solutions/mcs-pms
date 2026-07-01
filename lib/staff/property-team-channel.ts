import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

export const PROPERTY_TEAM_CHANNEL_NAME = 'Property team'

const STAFF_ROLES = ['owner', 'manager', 'receptionist', 'technician'] as const

type AdminClient = SupabaseClient<Database>

async function activeStaffIds(admin: AdminClient, hotelId: string): Promise<string[]> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('role', [...STAFF_ROLES])

  return (data ?? []).map((row) => row.id)
}

async function syncMembers(
  admin: AdminClient,
  conversationId: string,
  staffIds: string[],
): Promise<void> {
  if (staffIds.length === 0) return

  const { data: existing } = await admin
    .from('staff_conversation_members')
    .select('profile_id')
    .eq('conversation_id', conversationId)

  const have = new Set((existing ?? []).map((row) => row.profile_id))
  const missing = staffIds.filter((id) => !have.has(id))
  if (missing.length === 0) return

  await admin.from('staff_conversation_members').insert(
    missing.map((profileId) => ({
      conversation_id: conversationId,
      profile_id: profileId,
    })),
  )
}

/** Hotel-wide group chat for ops announcements — created on first use. */
export async function ensurePropertyTeamChannel(
  hotelId: string,
  createdBy: string,
): Promise<string | null> {
  const admin = createAdminClient()
  const staffIds = await activeStaffIds(admin, hotelId)
  if (staffIds.length === 0) return null

  const { data: existing } = await admin
    .from('staff_conversations')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('conversation_type', 'group')
    .eq('name', PROPERTY_TEAM_CHANNEL_NAME)
    .maybeSingle()

  if (existing?.id) {
    await syncMembers(admin, existing.id, staffIds)
    return existing.id
  }

  const { data: created, error } = await admin
    .from('staff_conversations')
    .insert({
      hotel_id: hotelId,
      conversation_type: 'group',
      name: PROPERTY_TEAM_CHANNEL_NAME,
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (error || !created) return null

  await admin.from('staff_conversation_members').insert(
    staffIds.map((profileId) => ({
      conversation_id: created.id,
      profile_id: profileId,
    })),
  )

  return created.id
}

export async function postPropertyTeamAnnouncement(input: {
  hotelId: string
  authorId: string
  body: string
}): Promise<boolean> {
  const conversationId = await ensurePropertyTeamChannel(input.hotelId, input.authorId)
  if (!conversationId) return false

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const trimmed = input.body.trim()
  if (!trimmed) return false

  const { error } = await admin.from('staff_conversation_messages').insert({
    conversation_id: conversationId,
    author_id: input.authorId,
    body: trimmed,
  })

  if (error) return false

  await admin
    .from('staff_conversations')
    .update({ updated_at: now })
    .eq('id', conversationId)

  return true
}
