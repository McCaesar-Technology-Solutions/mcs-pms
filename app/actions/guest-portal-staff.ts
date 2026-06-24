'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/log'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { getHotelLocalGuide, type LocalGuideRow } from '@/lib/data/local-guide'

export type GuestPortalStaffResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requirePortalEditor(hotelId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return { ok: false as const, error: 'Not authorized.' }

  if (profile.role === 'owner') {
    const owns = await ownerOwnsHotel(user.id, hotelId)
    if (!owns) return { ok: false as const, error: 'Not authorized for this property.' }
    return { ok: true as const, userId: user.id, actorName: profile.name }
  }

  if (profile.role === 'manager' && profile.hotel_id === hotelId) {
    return { ok: true as const, userId: user.id, actorName: profile.name }
  }

  return { ok: false as const, error: 'Only owners and managers can edit guest portal settings.' }
}

const portalSettingsSchema = z.object({
  wifiSsid: z.string().max(100).optional(),
  wifiPassword: z.string().max(100).optional(),
  parking: z.string().max(500).optional(),
  emergencyPhone: z.string().max(30).optional(),
  checkOutTime: z.string().max(30).optional(),
  welcome: z.string().max(1000).optional(),
})

const guideItemSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(5).max(2000),
})

function revalidatePortalViews() {
  revalidatePath('/owner/settings')
  revalidatePath('/manager/dashboard')
  revalidatePath('/guest')
}

export async function fetchGuestPortalSettings(hotelId: string): Promise<
  GuestPortalStaffResult<{
    wifiSsid: string | null
    wifiPassword: string | null
    parking: string | null
    emergencyPhone: string | null
    checkOutTime: string
    welcome: string | null
    localGuide: LocalGuideRow[]
  }>
> {
  const auth = await requirePortalEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const [hotelRes, localGuide] = await Promise.all([
    admin
      .from('hotels')
      .select(
        'guest_portal_wifi_ssid, guest_portal_wifi_password, guest_portal_parking, guest_portal_emergency_phone, guest_portal_check_out_time, guest_portal_welcome',
      )
      .eq('id', hotelId)
      .maybeSingle(),
    getHotelLocalGuide(hotelId),
  ])

  if (!hotelRes.data) return { success: false, error: 'Property not found.' }

  const h = hotelRes.data
  return {
    success: true,
    data: {
      wifiSsid: h.guest_portal_wifi_ssid,
      wifiPassword: h.guest_portal_wifi_password,
      parking: h.guest_portal_parking,
      emergencyPhone: h.guest_portal_emergency_phone,
      checkOutTime: h.guest_portal_check_out_time ?? '11:00 AM',
      welcome: h.guest_portal_welcome,
      localGuide,
    },
  }
}

export async function updateGuestPortalSettings(
  hotelId: string,
  input: unknown,
): Promise<GuestPortalStaffResult> {
  const auth = await requirePortalEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = portalSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('hotels')
    .update({
      guest_portal_wifi_ssid: parsed.data.wifiSsid?.trim() || null,
      guest_portal_wifi_password: parsed.data.wifiPassword?.trim() || null,
      guest_portal_parking: parsed.data.parking?.trim() || null,
      guest_portal_emergency_phone: parsed.data.emergencyPhone?.trim() || null,
      guest_portal_check_out_time: parsed.data.checkOutTime?.trim() || '11:00 AM',
      guest_portal_welcome: parsed.data.welcome?.trim() || null,
    })
    .eq('id', hotelId)

  if (error) return { success: false, error: 'Could not save portal settings.' }

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.actorName,
    entityType: 'hotel',
    entityId: hotelId,
    action: 'guest_portal_settings_updated',
    summary: 'Guest portal property info updated',
  })

  revalidatePortalViews()
  return { success: true }
}

export async function addLocalGuideItem(
  hotelId: string,
  input: unknown,
): Promise<GuestPortalStaffResult<{ id: string }>> {
  const auth = await requirePortalEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = guideItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid guide item.' }
  }

  const admin = createAdminClient()
  const { count } = await admin
    .from('hotel_local_guide')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  const { data, error } = await admin
    .from('hotel_local_guide')
    .insert({
      hotel_id: hotelId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      sort_order: count ?? 0,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Could not add guide item.' }

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.actorName,
    entityType: 'hotel',
    entityId: hotelId,
    action: 'local_guide_updated',
    summary: `Local guide item added: ${parsed.data.title.trim()}`,
  })

  revalidatePortalViews()
  return { success: true, data: { id: data.id } }
}

export async function updateLocalGuideItem(
  hotelId: string,
  itemId: string,
  input: unknown,
): Promise<GuestPortalStaffResult> {
  const auth = await requirePortalEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = guideItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid guide item.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('hotel_local_guide')
    .update({
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
    })
    .eq('id', itemId)
    .eq('hotel_id', hotelId)

  if (error) return { success: false, error: 'Could not update guide item.' }

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.actorName,
    entityType: 'hotel',
    entityId: hotelId,
    action: 'local_guide_updated',
    summary: `Local guide item updated: ${parsed.data.title.trim()}`,
  })

  revalidatePortalViews()
  return { success: true }
}

export async function removeLocalGuideItem(
  hotelId: string,
  itemId: string,
): Promise<GuestPortalStaffResult> {
  const auth = await requirePortalEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('hotel_local_guide')
    .select('title')
    .eq('id', itemId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  const { error } = await admin
    .from('hotel_local_guide')
    .delete()
    .eq('id', itemId)
    .eq('hotel_id', hotelId)

  if (error) return { success: false, error: 'Could not remove guide item.' }

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.actorName,
    entityType: 'hotel',
    entityId: hotelId,
    action: 'local_guide_updated',
    summary: `Local guide item removed${item?.title ? `: ${item.title}` : ''}`,
  })

  revalidatePortalViews()
  return { success: true }
}

const requestStatusSchema = z.enum(['acknowledged', 'completed', 'declined'])

export async function updateGuestRequestStatus(
  requestId: string,
  status: z.infer<typeof requestStatusSchema>,
): Promise<GuestPortalStaffResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !profile?.hotel_id ||
    !['owner', 'manager', 'receptionist'].includes(profile.role)
  ) {
    return { success: false, error: 'Not authorized.' }
  }

  const parsed = requestStatusSchema.safeParse(status)
  if (!parsed.success) return { success: false, error: 'Invalid status.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guest_requests')
    .update({ status: parsed.data, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not update request.' }

  revalidatePath('/manager/dashboard')
  revalidatePath('/guest')
  return { success: true }
}

export async function getStaffComplaintPhotoUrl(
  complaintId: string,
): Promise<GuestPortalStaffResult<{ url: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('hotel_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('complaints')
    .select('guest_photo_path, hotel_id')
    .eq('id', complaintId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!data?.guest_photo_path) return { success: false, error: 'No photo attached.' }

  const { GUEST_COMPLAINT_PHOTO_BUCKET } = await import('@/lib/guest/complaint-photos')
  const { data: signed } = await admin.storage
    .from(GUEST_COMPLAINT_PHOTO_BUCKET)
    .createSignedUrl(data.guest_photo_path, 3600)

  if (!signed?.signedUrl) return { success: false, error: 'Could not load photo.' }
  return { success: true, data: { url: signed.signedUrl } }
}
