'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/log'

export type WebsiteListingMapActionResult = { success: true } | { success: false; error: string }

const upsertSchema = z.object({
  hotelId: z.string().uuid(),
  websitePropertyId: z.string().uuid(),
  websiteSlug: z.string().trim().max(120).optional().or(z.literal('')),
  roomId: z.string().uuid().optional().or(z.literal('')),
})

const idSchema = z.object({
  hotelId: z.string().uuid(),
  mapId: z.string().uuid(),
})

function revalidate() {
  revalidatePath('/owner/settings')
}

async function requireOwner(hotelId: string) {
  const result = await requireVerifiedStaff()
  if (!result.ok || !result.profile) {
    return { profile: null as null, error: 'Not authorized.' }
  }
  if (result.profile.role !== 'owner' || result.profile.hotel_id !== hotelId) {
    return { profile: null, error: 'Only the property owner can map website listings.' }
  }
  return { profile: result.profile, error: null }
}

export async function upsertWebsiteListingMap(input: unknown): Promise<WebsiteListingMapActionResult> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid listing map.' }
  }

  const { profile, error } = await requireOwner(parsed.data.hotelId)
  if (!profile) return { success: false, error: error }

  const roomId = parsed.data.roomId ? parsed.data.roomId : null
  const admin = createAdminClient()

  if (roomId) {
    const { data: room } = await admin
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .eq('hotel_id', parsed.data.hotelId)
      .maybeSingle()
    if (!room) return { success: false, error: 'Room not found on this property.' }
  }

  const slug = parsed.data.websiteSlug?.trim() || null
  const { data: existing } = await admin
    .from('website_listing_maps')
    .select('id, hotel_id')
    .eq('website_property_id', parsed.data.websitePropertyId)
    .maybeSingle()

  if (existing && existing.hotel_id !== parsed.data.hotelId) {
    return { success: false, error: 'That website listing is already mapped to another property.' }
  }

  if (existing) {
    const { error: updateError } = await admin
      .from('website_listing_maps')
      .update({
        room_id: roomId,
        website_slug: slug,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updateError) return { success: false, error: updateError.message }
  } else {
    const { error: insertError } = await admin.from('website_listing_maps').insert({
      hotel_id: parsed.data.hotelId,
      room_id: roomId,
      website_property_id: parsed.data.websitePropertyId,
      website_slug: slug,
      is_active: true,
    })
    if (insertError) return { success: false, error: insertError.message }
  }

  void writeAuditLog({
    hotelId: parsed.data.hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'hotel',
    entityId: parsed.data.hotelId,
    action: 'website_listing_mapped',
    summary: `Mapped website listing ${parsed.data.websitePropertyId}`,
  })

  revalidate()
  return { success: true }
}

export async function deleteWebsiteListingMap(input: unknown): Promise<WebsiteListingMapActionResult> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid listing map.' }
  }

  const { profile, error } = await requireOwner(parsed.data.hotelId)
  if (!profile) return { success: false, error: error }

  const admin = createAdminClient()
  const { error: deleteError } = await admin
    .from('website_listing_maps')
    .delete()
    .eq('id', parsed.data.mapId)
    .eq('hotel_id', parsed.data.hotelId)

  if (deleteError) return { success: false, error: deleteError.message }

  revalidate()
  return { success: true }
}
