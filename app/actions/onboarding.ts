'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureGuestPortalSlug } from '@/lib/guest-portal'
import { ensureDefaultGuestRules } from '@/lib/data/guest-rules'
import { seedDefaultRoomCategories } from '@/lib/data/room-categories'
import { ensureExportFeedsForHotel } from '@/lib/channels/ensure-export-feeds'
import { inviteStaff } from '@/app/actions/staff'
import type { OnboardingStep, VatMode } from '@/types'

export type OnboardingActionResult = { success: true } | { success: false; error: string }

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Volta',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Savannah',
  'North East',
  'Oti',
  'Western North',
] as const

const propertyStepSchema = z.object({
  name: z.string().min(2, 'Property name is required'),
  address: z.string().min(3, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  region: z.enum(GHANA_REGIONS),
  totalRooms: z.coerce.number().int().min(1).max(200),
})

const complianceStepSchema = z.object({
  gtaLicenseNumber: z.string().max(80).optional().or(z.literal('')),
  gtaLicenseExpiry: z.string().optional().or(z.literal('')),
  vatRegistrationNumber: z.string().max(80).optional().or(z.literal('')),
  vatMode: z.enum(['exclusive', 'inclusive']),
})

const teamStepSchema = z.object({
  managerEmail: z.string().email().optional().or(z.literal('')),
  skip: z.boolean().optional(),
})

async function requireOnboardingOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, onboarding_step, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner' || profile.onboarding_completed_at) return null
  return { supabase, profile, userId: user.id }
}

async function advanceStep(userId: string, step: OnboardingStep) {
  const admin = createAdminClient()
  await admin.from('profiles').update({ onboarding_step: step }).eq('id', userId)
}

async function seedRoomsForHotel(
  hotelId: string,
  totalRooms: number,
  ownerId: string,
): Promise<void> {
  const admin = createAdminClient()
  const standardCategoryId = await seedDefaultRoomCategories(admin, hotelId)
  if (!standardCategoryId) throw new Error('Could not create room categories.')

  const { data: standardCategory } = await admin
    .from('room_categories')
    .select('id, default_nightly_rate')
    .eq('hotel_id', hotelId)
    .eq('name', 'Standard')
    .maybeSingle()

  const categoryId = standardCategory?.id ?? standardCategoryId
  const nightlyRate = Number(standardCategory?.default_nightly_rate ?? 250)

  const rooms = Array.from({ length: totalRooms }, (_, i) => ({
    hotel_id: hotelId,
    number: String(i + 1),
    floor: 1,
    category_id: categoryId,
    nightly_rate: nightlyRate,
    status: 'available' as const,
    updated_by: ownerId,
  }))

  const { error } = await admin.from('rooms').insert(rooms)
  if (error) throw new Error(error.message)
}

function revalidateAll() {
  revalidatePath('/get-started')
  revalidatePath('/owner/dashboard')
}

export async function completeWelcomeStep(): Promise<OnboardingActionResult> {
  const ctx = await requireOnboardingOwner()
  if (!ctx) return { success: false, error: 'Setup is not available.' }

  await advanceStep(ctx.userId, 'property')
  revalidateAll()
  return { success: true }
}

export async function completePropertyStep(input: unknown): Promise<OnboardingActionResult> {
  const parsed = propertyStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid property details.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx) return { success: false, error: 'Setup is not available.' }

  if (ctx.profile.hotel_id) {
    await advanceStep(ctx.userId, 'compliance')
    revalidateAll()
    return { success: true }
  }

  const admin = createAdminClient()

  const { data: hotel, error: hotelError } = await admin
    .from('hotels')
    .insert({
      name: parsed.data.name.trim(),
      address: parsed.data.address.trim(),
      city: parsed.data.city.trim(),
      region: parsed.data.region,
      owner_id: ctx.userId,
      vat_mode: 'exclusive',
    })
    .select('id')
    .single()

  if (hotelError || !hotel) {
    return { success: false, error: hotelError?.message ?? 'Could not create property.' }
  }

  try {
    await seedRoomsForHotel(hotel.id, parsed.data.totalRooms, ctx.userId)
    await ensureGuestPortalSlug(hotel.id)
    await ensureDefaultGuestRules(hotel.id)
    await ensureExportFeedsForHotel(hotel.id)
  } catch (err) {
    await admin.from('rooms').delete().eq('hotel_id', hotel.id)
    await admin.from('hotels').delete().eq('id', hotel.id)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not set up rooms.',
    }
  }

  const { error: linkError } = await admin
    .from('profiles')
    .update({ hotel_id: hotel.id, onboarding_step: 'compliance' })
    .eq('id', ctx.userId)

  if (linkError) {
    return { success: false, error: 'Property created but account link failed.' }
  }

  revalidateAll()
  return { success: true }
}

export async function completeComplianceStep(input: unknown): Promise<OnboardingActionResult> {
  const parsed = complianceStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid compliance details.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx?.profile.hotel_id) {
    return { success: false, error: 'Create your property first.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('hotels')
    .update({
      gta_license_number: parsed.data.gtaLicenseNumber?.trim() || null,
      gta_license_expiry: parsed.data.gtaLicenseExpiry?.trim() || null,
      vat_registration_number: parsed.data.vatRegistrationNumber?.trim() || null,
      vat_mode: parsed.data.vatMode as VatMode,
    })
    .eq('id', ctx.profile.hotel_id)

  if (error) return { success: false, error: error.message }

  await advanceStep(ctx.userId, 'team')
  revalidateAll()
  return { success: true }
}

export async function completeTeamStep(input: unknown): Promise<OnboardingActionResult> {
  const parsed = teamStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx?.profile.hotel_id) {
    return { success: false, error: 'Create your property first.' }
  }

  const email = parsed.data.managerEmail?.trim()
  if (!parsed.data.skip && email) {
    const invite = await inviteStaff(email, 'manager')
    if (!invite.success) {
      return { success: false, error: invite.error }
    }
  }

  await advanceStep(ctx.userId, 'done')
  revalidateAll()
  return { success: true }
}

export async function finishOnboarding(): Promise<OnboardingActionResult> {
  const ctx = await requireOnboardingOwner()
  if (!ctx) return { success: false, error: 'Setup is not available.' }

  if (!ctx.profile.hotel_id) {
    return { success: false, error: 'Add your first property before launching.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      onboarding_step: 'done',
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', ctx.userId)

  if (error) return { success: false, error: error.message }

  revalidateAll()
  return { success: true }
}
