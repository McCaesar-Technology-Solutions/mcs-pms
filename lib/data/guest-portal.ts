import { createAdminClient } from '@/lib/supabase/admin'
import { getHotelGuestRules, type GuestRuleRow } from '@/lib/data/guest-rules'
import { getHotelLocalGuide, type LocalGuideRow } from '@/lib/data/local-guide'
import { propertyImagePublicUrl } from '@/lib/properties/image-storage'
import type { Guest } from '@/types'

export interface GuestPortalPropertyInfo {
  hotelId: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  imageUrl: string | null
  wifiSsid: string | null
  wifiPassword: string | null
  parking: string | null
  emergencyPhone: string | null
  checkOutTime: string
  welcome: string | null
}

export interface GuestPortalInvoice {
  id: string
  invoiceNumber: string | null
  totalAmount: number
  paymentStatus: string
  issuedAt: string | null
  paidAt: string | null
}

export interface GuestPortalRequest {
  id: string
  requestType: 'housekeeping' | 'late_checkout' | 'extension' | 'self_checkout'
  note: string | null
  status: string
  createdAt: string
}

export interface GuestRequestPanelRow extends GuestPortalRequest {
  guestName: string
  roomNumber: string | null
}

export interface GuestPortalContext {
  property: GuestPortalPropertyInfo
  rules: GuestRuleRow[]
  localGuide: LocalGuideRow[]
  invoices: GuestPortalInvoice[]
  requests: GuestPortalRequest[]
  hasFeedback: boolean
}

export async function loadGuestPortalContext(guest: Guest): Promise<GuestPortalContext | null> {
  const admin = createAdminClient()
  const [{ data: hotel }, rulesBundle, localGuide, invoicesRes, requestsRes, feedbackRes] =
    await Promise.all([
      admin
        .from('hotels')
        .select(
          'id, name, address, city, region, profile_image_path, guest_portal_wifi_ssid, guest_portal_wifi_password, guest_portal_parking, guest_portal_emergency_phone, guest_portal_check_out_time, guest_portal_welcome',
        )
        .eq('id', guest.hotel_id)
        .maybeSingle(),
      getHotelGuestRules(guest.hotel_id),
      getHotelLocalGuide(guest.hotel_id),
      admin
        .from('invoices')
        .select('id, invoice_number, total_amount, payment_status, issued_at, paid_at')
        .eq('guest_id', guest.id)
        .order('issued_at', { ascending: false })
        .limit(10),
      admin
        .from('guest_requests')
        .select('id, request_type, note, status, created_at')
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('guest_feedback')
        .select('id')
        .eq('guest_id', guest.id)
        .limit(1),
    ])

  if (!hotel) return null

  return {
    property: {
      hotelId: hotel.id,
      name: hotel.name,
      address: hotel.address,
      city: hotel.city,
      region: hotel.region,
      imageUrl: propertyImagePublicUrl(hotel.profile_image_path),
      wifiSsid: hotel.guest_portal_wifi_ssid,
      wifiPassword: hotel.guest_portal_wifi_password,
      parking: hotel.guest_portal_parking,
      emergencyPhone: hotel.guest_portal_emergency_phone,
      checkOutTime: hotel.guest_portal_check_out_time ?? '11:00 AM',
      welcome: hotel.guest_portal_welcome,
    },
    rules: rulesBundle?.rules ?? [],
    localGuide,
    invoices: (invoicesRes.data ?? []).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      totalAmount: Number(row.total_amount),
      paymentStatus: row.payment_status ?? 'pending',
      issuedAt: row.issued_at,
      paidAt: row.paid_at,
    })),
    requests: (requestsRes.data ?? []).map((row) => ({
      id: row.id,
      requestType: row.request_type as GuestPortalRequest['requestType'],
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
    })),
    hasFeedback: (feedbackRes.data?.length ?? 0) > 0,
  }
}

export async function loadHotelGuestRequests(hotelId: string): Promise<GuestRequestPanelRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guest_requests')
    .select('id, request_type, note, status, created_at, guests(name), rooms(number)')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(15)

  return (data ?? []).map((row) => {
    const guest =
      row.guests && typeof row.guests === 'object' && 'name' in row.guests
        ? (row.guests as { name: string }).name
        : 'Guest'
    const room =
      row.rooms && typeof row.rooms === 'object' && 'number' in row.rooms
        ? (row.rooms as { number: string }).number
        : null
    return {
      id: row.id,
      requestType: row.request_type as GuestPortalRequest['requestType'],
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
      guestName: guest,
      roomNumber: room,
    }
  })
}
