'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  loadStaffConversationMessages,
  type StaffConversationMessage,
} from '@/lib/data/staff-conversations'

export type StaffConversationActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const STAFF_MESSAGING_ROLES = new Set(['owner', 'manager', 'receptionist', 'technician'])

const messageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

const groupSchema = z.object({
  name: z.string().min(1).max(80),
  memberIds: z.array(z.string().uuid()).min(1).max(20),
})

async function requireStaffMessenger() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !STAFF_MESSAGING_ROLES.has(profile.role)) return null
  return profile
}

function dmKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(':')
}

function revalidateStaffMessagePaths() {
  revalidatePath('/owner/messages')
  revalidatePath('/manager/messages')
  revalidatePath('/receptionist/messages')
  revalidatePath('/technician/messages')
}

async function assertMember(conversationId: string, profileId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('staff_conversation_members')
    .select('profile_id')
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()
  return Boolean(data)
}

export async function getStaffTeamMessages(
  conversationId: string,
): Promise<StaffConversationActionResult<StaffConversationMessage[]>> {
  const profile = await requireStaffMessenger()
  if (!profile) return { success: false, error: 'Not authorized.' }

  if (!(await assertMember(conversationId, profile.id))) {
    return { success: false, error: 'Conversation not found.' }
  }

  const messages = await loadStaffConversationMessages(conversationId, profile.id)

  const admin = createAdminClient()
  await admin
    .from('staff_conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profile.id)

  return { success: true, data: messages }
}

export async function postStaffTeamMessage(input: {
  conversationId: string
  body: string
}): Promise<StaffConversationActionResult> {
  const parsed = messageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const profile = await requireStaffMessenger()
  if (!profile) return { success: false, error: 'Not authorized.' }

  if (!(await assertMember(parsed.data.conversationId, profile.id))) {
    return { success: false, error: 'Conversation not found.' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin.from('staff_conversation_messages').insert({
    conversation_id: parsed.data.conversationId,
    author_id: profile.id,
    body: parsed.data.body.trim(),
  })

  if (error) return { success: false, error: error.message }

  await admin
    .from('staff_conversations')
    .update({ updated_at: now })
    .eq('id', parsed.data.conversationId)

  revalidateStaffMessagePaths()
  return { success: true }
}

export async function startStaffDm(
  otherProfileId: string,
): Promise<StaffConversationActionResult<{ conversationId: string }>> {
  const profile = await requireStaffMessenger()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  if (otherProfileId === profile.id) {
    return { success: false, error: 'You cannot message yourself.' }
  }

  const admin = createAdminClient()
  const { data: other } = await admin
    .from('profiles')
    .select('id, hotel_id')
    .eq('id', otherProfileId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!other) return { success: false, error: 'Staff member not found.' }

  const key = dmKey(profile.id, otherProfileId)
  const { data: existing } = await admin
    .from('staff_conversations')
    .select('id')
    .eq('hotel_id', profile.hotel_id)
    .eq('dm_key', key)
    .maybeSingle()

  if (existing) return { success: true, data: { conversationId: existing.id } }

  const { data: created, error } = await admin
    .from('staff_conversations')
    .insert({
      hotel_id: profile.hotel_id!,
      conversation_type: 'dm',
      dm_key: key,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !created) return { success: false, error: error?.message ?? 'Could not start chat.' }

  const { error: memberError } = await admin.from('staff_conversation_members').insert([
    { conversation_id: created.id, profile_id: profile.id },
    { conversation_id: created.id, profile_id: otherProfileId },
  ])

  if (memberError) {
    await admin.from('staff_conversations').delete().eq('id', created.id)
    return { success: false, error: memberError.message }
  }

  revalidateStaffMessagePaths()
  return { success: true, data: { conversationId: created.id } }
}

export async function createStaffGroupChat(input: {
  name: string
  memberIds: string[]
}): Promise<StaffConversationActionResult<{ conversationId: string }>> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid group.' }
  }

  const profile = await requireStaffMessenger()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const memberSet = new Set(parsed.data.memberIds)
  memberSet.add(profile.id)

  const admin = createAdminClient()
  const { data: validMembers } = await admin
    .from('profiles')
    .select('id')
    .eq('hotel_id', profile.hotel_id)
    .in('id', [...memberSet])

  if ((validMembers?.length ?? 0) !== memberSet.size) {
    return { success: false, error: 'One or more staff members are invalid.' }
  }

  const { data: created, error } = await admin
    .from('staff_conversations')
    .insert({
      hotel_id: profile.hotel_id!,
      conversation_type: 'group',
      name: parsed.data.name.trim(),
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !created) return { success: false, error: error?.message ?? 'Could not create group.' }

  const rows = [...memberSet].map((id) => ({
    conversation_id: created.id,
    profile_id: id,
  }))

  const { error: memberError } = await admin.from('staff_conversation_members').insert(rows)
  if (memberError) {
    await admin.from('staff_conversations').delete().eq('id', created.id)
    return { success: false, error: memberError.message }
  }

  revalidateStaffMessagePaths()
  return { success: true, data: { conversationId: created.id } }
}
