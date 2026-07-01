'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'

export type OpsCalendarActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const eventSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.enum(['training', 'meeting', 'guest_service', 'maintenance', 'event', 'general']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  roomId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
})

async function requireOpsStaff() {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager', 'receptionist'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  return result.profile
}

function revalidateCalendar() {
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
  revalidatePath('/receptionist/dashboard')
}

export async function createOpsCalendarEvent(
  input: z.infer<typeof eventSchema>,
): Promise<OpsCalendarActionResult> {
  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid event.' }
  }

  const profile = await requireOpsStaff()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { error } = await admin.from('ops_calendar_events').insert({
    hotel_id: profile.hotel_id!,
    title: parsed.data.title.trim(),
    category: parsed.data.category,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt ?? null,
    all_day: parsed.data.allDay ?? false,
    room_id: parsed.data.roomId ?? null,
    notes: parsed.data.notes?.trim() || null,
    created_by: profile.id,
  })

  if (error) return { success: false, error: error.message }
  revalidateCalendar()
  return { success: true }
}

export async function deleteOpsCalendarEvent(id: string): Promise<OpsCalendarActionResult> {
  const profile = await requireOpsStaff()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ops_calendar_events')
    .delete()
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id!)

  if (error) return { success: false, error: error.message }
  revalidateCalendar()
  return { success: true }
}
