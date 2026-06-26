import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function ensureGuestConversation(
  admin: AdminClient,
  hotelId: string,
  guestId: string,
): Promise<{ id: string }> {
  const { data: existing } = await admin
    .from('guest_conversations')
    .select('id')
    .eq('guest_id', guestId)
    .maybeSingle()

  if (existing) return { id: existing.id }

  const { data, error } = await admin
    .from('guest_conversations')
    .insert({ hotel_id: hotelId, guest_id: guestId })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Could not start conversation.')
  }

  return { id: data.id }
}
