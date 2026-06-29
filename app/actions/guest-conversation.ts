'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGuestFromSession } from '@/app/actions/guest'
import { guestNeedsRulesAcceptance } from '@/app/actions/guest-rules'
import { ensureGuestConversation } from '@/lib/guest-conversation/ensure'
import {
  assertRateLimit,
  GUEST_RATE_LIMITS,
  guestRateKey,
} from '@/lib/rate-limit'
import type { Guest } from '@/types'
import { guestFacingAuthorName } from '@/lib/contacts/display'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'
import { canEditOwnMessage } from '@/lib/messaging/can-edit-message'

export type GuestConversationActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const stayMessageSchema = z.object({
  body: z.string().min(1).max(2000),
})

const staffMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

const editMessageSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

const FRONT_DESK_ROLES = new Set(['owner', 'manager', 'receptionist'])

async function requireGuestWithRules(): Promise<
  | { ok: true; guest: Guest; roomNumber: string | null }
  | { ok: false; error: string }
> {
  const session = await getGuestFromSession()
  if (!session.success) {
    return { ok: false, error: session.error ?? 'Session expired. Use your guest link again.' }
  }
  if (!session.data) {
    return { ok: false, error: 'Session expired. Use your guest link again.' }
  }
  if (await guestNeedsRulesAcceptance(session.data.guest.id)) {
    return { ok: false, error: 'Please accept the property rules first.' }
  }
  return {
    ok: true,
    guest: session.data.guest,
    roomNumber: session.data.roomNumber,
  }
}

async function requireFrontDeskProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !FRONT_DESK_ROLES.has(profile.role)) return null
  return profile
}

async function assertConversationAccess(
  conversationId: string,
  hotelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guest_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'Conversation not found.' }
  return { ok: true }
}

function revalidateStayChatPaths() {
  revalidatePath('/guest')
  revalidatePath('/manager/messages')
  revalidatePath('/receptionist/messages')
  revalidatePath('/manager/dashboard')
  revalidatePath('/receptionist/dashboard')
}

export async function getGuestStayConversationId(): Promise<
  GuestConversationActionResult<{ conversationId: string }>
> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { id } = await ensureGuestConversation(admin, auth.guest.hotel_id, auth.guest.id)
  return { success: true, data: { conversationId: id } }
}

export async function getGuestStayMessages(): Promise<
  GuestConversationActionResult<{
    conversationId: string
    guestAvatarUrl: string | null
    messages: {
      id: string
      authorRole: string
      body: string
      createdAt: string
      authorName: string | null
      authorAvatarUrl: string | null
      editedAt?: string | null
      canEdit?: boolean
    }[]
  }>
> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { id: conversationId } = await ensureGuestConversation(
    admin,
    auth.guest.hotel_id,
    auth.guest.id,
  )

  const guestAvatarUrl = profilePhotoPublicUrl(auth.guest.profile_image_path)

  const { data: conversationRow } = await admin
    .from('guest_conversations')
    .select('staff_last_read_at')
    .eq('id', conversationId)
    .maybeSingle()

  const staffLastRead = conversationRow?.staff_last_read_at

  await admin
    .from('guest_conversations')
    .update({ guest_last_read_at: new Date().toISOString() })
    .eq('id', conversationId)

  const { data } = await admin
    .from('guest_conversation_messages')
    .select('id, author_role, body, created_at, edited_at, author_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const staffIds = [
    ...new Set(
      (data ?? [])
        .filter((m) => m.author_role === 'staff' && m.author_id)
        .map((m) => m.author_id as string),
    ),
  ]

  const { data: profiles } = staffIds.length
    ? await admin.from('profiles').select('id, name, role, profile_image_path').in('id', staffIds)
    : { data: [] as { id: string; name: string; role: string; profile_image_path: string | null }[] }

  const staffById = new Map((profiles ?? []).map((p) => [p.id, p]))

  return {
    success: true,
    data: {
      conversationId,
      guestAvatarUrl,
      messages: (data ?? []).map((m) => {
        const isGuest = m.author_role === 'guest'
        const staff = !isGuest && m.author_id ? staffById.get(m.author_id) : null
        return {
          id: m.id,
          authorRole: m.author_role,
          body: m.body,
          createdAt: m.created_at ?? new Date(0).toISOString(),
          editedAt: m.edited_at ?? null,
          authorName: isGuest
            ? auth.guest.name
            : guestFacingAuthorName(staff?.name, staff?.role),
          authorAvatarUrl: isGuest
            ? guestAvatarUrl
            : staff?.role === 'owner'
              ? null
              : profilePhotoPublicUrl(staff?.profile_image_path),
          canEdit:
            isGuest &&
            canEditOwnMessage(m.created_at ?? new Date(0).toISOString(), [staffLastRead]),
        }
      }),
    },
  }
}

export async function postGuestStayMessage(input: unknown): Promise<GuestConversationActionResult> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const limit = await assertRateLimit(
    guestRateKey('stay-chat', auth.guest.id),
    GUEST_RATE_LIMITS.message,
  )
  if (limit) return { success: false, error: limit }

  const parsed = stayMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const admin = createAdminClient()
  const { id: conversationId } = await ensureGuestConversation(
    admin,
    auth.guest.hotel_id,
    auth.guest.id,
  )

  const body = parsed.data.body.trim()
  const now = new Date().toISOString()

  const { error } = await admin.from('guest_conversation_messages').insert({
    conversation_id: conversationId,
    author_role: 'guest',
    author_id: null,
    body,
  })

  if (error) return { success: false, error: 'Could not send message.' }

  await admin
    .from('guest_conversations')
    .update({ updated_at: now })
    .eq('id', conversationId)

  void import('@/lib/notifications/guest-conversation').then(({ notifyGuestStayMessageToManagers }) =>
    notifyGuestStayMessageToManagers({
      hotelId: auth.guest.hotel_id,
      guestName: auth.guest.name,
      roomNumber: auth.roomNumber,
      messagePreview: body,
      conversationId,
    }).catch(() => undefined),
  )

  revalidateStayChatPaths()
  return { success: true }
}

export async function getStaffGuestStayMessages(
  conversationId: string,
): Promise<
  GuestConversationActionResult<
    {
      id: string
      authorRole: string
      body: string
      createdAt: string
      authorName: string | null
      authorAvatarUrl: string | null
      editedAt?: string | null
      canEdit?: boolean
    }[]
  >
> {
  const profile = await requireFrontDeskProfile()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const access = await assertConversationAccess(conversationId, profile.hotel_id!)
  if (!access.ok) return { success: false, error: access.error }

  const admin = createAdminClient()

  const { data: conversation } = await admin
    .from('guest_conversations')
    .select('guest_id, guest_last_read_at, guests(name, profile_image_path)')
    .eq('id', conversationId)
    .maybeSingle()

  const guestRow = conversation?.guests as {
    name?: string
    profile_image_path?: string | null
  } | null
  const guestAvatarUrl = profilePhotoPublicUrl(guestRow?.profile_image_path)
  const guestLastRead = conversation?.guest_last_read_at

  const { data } = await admin
    .from('guest_conversation_messages')
    .select('id, author_role, body, created_at, edited_at, author_id, profiles(name, profile_image_path)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  await admin
    .from('guest_conversations')
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq('id', conversationId)

  return {
    success: true,
    data: (data ?? []).map((m) => {
      const authorProfile =
        m.profiles && typeof m.profiles === 'object' && 'name' in m.profiles
          ? (m.profiles as { name: string; profile_image_path?: string | null })
          : null
      const isGuest = m.author_role === 'guest'
      return {
        id: m.id,
        authorRole: m.author_role,
        body: m.body,
        createdAt: m.created_at ?? new Date(0).toISOString(),
        editedAt: m.edited_at ?? null,
        authorName: isGuest ? (guestRow?.name ?? 'Guest') : (authorProfile?.name ?? null),
        authorAvatarUrl: isGuest
          ? guestAvatarUrl
          : profilePhotoPublicUrl(authorProfile?.profile_image_path),
        canEdit:
          !isGuest &&
          m.author_id === profile.id &&
          canEditOwnMessage(m.created_at ?? new Date(0).toISOString(), [guestLastRead]),
      }
    }),
  }
}

export async function postStaffGuestStayMessage(
  input: unknown,
): Promise<GuestConversationActionResult> {
  const profile = await requireFrontDeskProfile()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const parsed = staffMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const access = await assertConversationAccess(parsed.data.conversationId, profile.hotel_id!)
  if (!access.ok) return { success: false, error: access.error }

  const admin = createAdminClient()
  const { data: conversation } = await admin
    .from('guest_conversations')
    .select('guest_id, guests(name, phone, rooms(number))')
    .eq('id', parsed.data.conversationId)
    .maybeSingle()

  if (!conversation) return { success: false, error: 'Conversation not found.' }

  const body = parsed.data.body.trim()
  const now = new Date().toISOString()

  const { error } = await admin.from('guest_conversation_messages').insert({
    conversation_id: parsed.data.conversationId,
    author_role: 'staff',
    author_id: profile.id,
    body,
  })

  if (error) return { success: false, error: 'Could not send message.' }

  await admin
    .from('guest_conversations')
    .update({ updated_at: now, staff_last_read_at: now })
    .eq('id', parsed.data.conversationId)

  const guest = conversation.guests as {
    name?: string
    phone?: string | null
    rooms?: { number?: string } | null
  } | null

  void import('@/lib/notifications/guest-conversation').then(({ notifyStaffStayMessageToGuest }) =>
    notifyStaffStayMessageToGuest({
      hotelId: profile.hotel_id!,
      guestId: conversation.guest_id,
      guestPhone: guest?.phone?.trim() ?? null,
      messagePreview: body,
    }).catch(() => undefined),
  )

  revalidateStayChatPaths()
  return { success: true }
}

export async function editGuestStayMessage(input: unknown): Promise<GuestConversationActionResult> {
  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = editMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const admin = createAdminClient()
  const { id: conversationId } = await ensureGuestConversation(
    admin,
    auth.guest.hotel_id,
    auth.guest.id,
  )

  const { data: conversation } = await admin
    .from('guest_conversations')
    .select('staff_last_read_at')
    .eq('id', conversationId)
    .maybeSingle()

  const { data: message } = await admin
    .from('guest_conversation_messages')
    .select('id, conversation_id, author_role, created_at')
    .eq('id', parsed.data.messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (!message || message.author_role !== 'guest') {
    return { success: false, error: 'Message not found.' }
  }

  if (
    !canEditOwnMessage(message.created_at ?? new Date(0).toISOString(), [
      conversation?.staff_last_read_at,
    ])
  ) {
    return { success: false, error: 'This message can no longer be edited.' }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('guest_conversation_messages')
    .update({ body: parsed.data.body.trim(), edited_at: now })
    .eq('id', message.id)

  if (error) return { success: false, error: 'Could not update message.' }

  await admin.from('guest_conversations').update({ updated_at: now }).eq('id', conversationId)
  revalidateStayChatPaths()
  return { success: true }
}

export async function editStaffGuestStayMessage(
  input: unknown,
): Promise<GuestConversationActionResult> {
  const profile = await requireFrontDeskProfile()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const parsed = editMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const admin = createAdminClient()
  const { data: message } = await admin
    .from('guest_conversation_messages')
    .select('id, conversation_id, author_id, author_role, created_at')
    .eq('id', parsed.data.messageId)
    .maybeSingle()

  if (!message || message.author_role !== 'staff' || message.author_id !== profile.id) {
    return { success: false, error: 'Message not found.' }
  }

  const access = await assertConversationAccess(message.conversation_id, profile.hotel_id!)
  if (!access.ok) return { success: false, error: access.error }

  const { data: conversation } = await admin
    .from('guest_conversations')
    .select('guest_last_read_at')
    .eq('id', message.conversation_id)
    .maybeSingle()

  if (
    !canEditOwnMessage(message.created_at ?? new Date(0).toISOString(), [
      conversation?.guest_last_read_at,
    ])
  ) {
    return { success: false, error: 'This message can no longer be edited.' }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('guest_conversation_messages')
    .update({ body: parsed.data.body.trim(), edited_at: now })
    .eq('id', message.id)

  if (error) return { success: false, error: 'Could not update message.' }

  await admin
    .from('guest_conversations')
    .update({ updated_at: now })
    .eq('id', message.conversation_id)

  revalidateStayChatPaths()
  return { success: true }
}

export async function getGuestConversationContextAction(
  conversationId: string,
): Promise<
  GuestConversationActionResult<import('@/lib/data/guest-conversation-context').GuestConversationContext>
> {
  const profile = await requireFrontDeskProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const access = await assertConversationAccess(conversationId, profile.hotel_id)
  if (!access.ok) return { success: false, error: access.error }

  const { loadGuestConversationContext } = await import('@/lib/data/guest-conversation-context')
  const context = await loadGuestConversationContext(conversationId)
  if (!context) return { success: false, error: 'Guest not found.' }
  return { success: true, data: context }
}
