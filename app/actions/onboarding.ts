'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureGuestPortalSlug } from '@/lib/guest-portal'
import { ensureDefaultGuestRules } from '@/lib/data/guest-rules'
import { seedDefaultRoomCategories } from '@/lib/data/room-categories'
import { ensureOwnerOrganization } from '@/lib/saas/provision-organization'
import { inviteStaff } from '@/app/actions/staff'
import {
  canNavigateToOnboardingStep,
  resolveOnboardingStepAfterComplete,
  type OnboardingStep,
} from '@/lib/onboarding/state'
import type { VatMode } from '@/types'

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
  vatRegistrationNumber: z.string().max(80).optional().or(z.literal('')),
  vatMode: z.enum(['exclusive', 'inclusive']),
})

const teamStepSchema = z.object({
  managerEmail: z.string().email().optional().or(z.literal('')),
  skip: z.boolean().optional(),
})

const resumeStepSchema = z.enum(['welcome', 'property', 'compliance', 'team', 'done']).optional()

async function requireOnboardingOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, onboarding_step, onboarding_completed_at, name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner' || profile.onboarding_completed_at) return null
  return { supabase, profile, userId: user.id }
}

async function advanceStep(userId: string, step: OnboardingStep) {
  const admin = createAdminClient()
  await admin.from('profiles').update({ onboarding_step: step }).eq('id', userId)
}

async function syncRoomCount(
  hotelId: string,
  targetCount: number,
  ownerId: string,
): Promise<void> {
  const admin = createAdminClient()
  const { count, error: countError } = await admin
    .from('rooms')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  if (countError) throw new Error(countError.message)

  const current = count ?? 0
  if (targetCount === current) return

  if (targetCount > current) {
    const { data: standardCategory } = await admin
      .from('room_categories')
      .select('id, default_nightly_rate')
      .eq('hotel_id', hotelId)
      .eq('name', 'Standard')
      .maybeSingle()

    if (!standardCategory?.id) throw new Error('Could not find a room category for new rooms.')

    const nightlyRate = Number(standardCategory.default_nightly_rate ?? 250)
    const rooms = Array.from({ length: targetCount - current }, (_, i) => ({
      hotel_id: hotelId,
      number: String(current + i + 1),
      floor: 1,
      category_id: standardCategory.id,
      nightly_rate: nightlyRate,
      status: 'available' as const,
      updated_by: ownerId,
    }))

    const { error } = await admin.from('rooms').insert(rooms)
    if (error) throw new Error(error.message)
    return
  }

  const toRemove = current - targetCount
  const { data: rooms, error: roomsError } = await admin
    .from('rooms')
    .select('id, number, status')
    .eq('hotel_id', hotelId)
    .order('number', { ascending: false })
    .limit(toRemove)

  if (roomsError) throw new Error(roomsError.message)
  if ((rooms?.length ?? 0) < toRemove) {
    throw new Error('Could not reduce room count.')
  }

  const blocked = rooms?.find((room) => room.status !== 'available')
  if (blocked) {
    throw new Error(
      'Cannot remove rooms that are occupied or out of service. Free them in Rooms first, or keep the current count.',
    )
  }

  const { error: deleteError } = await admin
    .from('rooms')
    .delete()
    .in('id', rooms!.map((room) => room.id))

  if (deleteError) throw new Error(deleteError.message)
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

export async function goToOnboardingStep(targetStep: unknown): Promise<OnboardingActionResult> {
  const parsed = resumeStepSchema.safeParse(targetStep)
  if (!parsed.success || !parsed.data) {
    return { success: false, error: 'Invalid step.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx) return { success: false, error: 'Setup is not available.' }

  const current = (ctx.profile.onboarding_step ?? 'welcome') as OnboardingStep
  if (!canNavigateToOnboardingStep(current, parsed.data)) {
    return { success: false, error: 'Complete the current step before moving forward.' }
  }

  await advanceStep(ctx.userId, parsed.data)
  revalidateAll()
  return { success: true }
}

export async function completeWelcomeStep(resumeStep?: unknown): Promise<OnboardingActionResult> {
  const ctx = await requireOnboardingOwner()
  if (!ctx) return { success: false, error: 'Setup is not available.' }

  const resume = resumeStepSchema.safeParse(resumeStep).data ?? null
  const next = resolveOnboardingStepAfterComplete('welcome', resume)
  await advanceStep(ctx.userId, next)
  revalidateAll()
  return { success: true }
}

export async function completePropertyStep(
  input: unknown,
  resumeStep?: unknown,
): Promise<OnboardingActionResult> {
  const parsed = propertyStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid property details.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx) return { success: false, error: 'Setup is not available.' }

  const resume = resumeStepSchema.safeParse(resumeStep).data ?? null
  const next = resolveOnboardingStepAfterComplete('property', resume)
  const admin = createAdminClient()

  if (ctx.profile.hotel_id) {
    const { error: hotelError } = await admin
      .from('hotels')
      .update({
        name: parsed.data.name.trim(),
        address: parsed.data.address.trim(),
        city: parsed.data.city.trim(),
        region: parsed.data.region,
      })
      .eq('id', ctx.profile.hotel_id)

    if (hotelError) {
      return { success: false, error: hotelError.message ?? 'Could not update property.' }
    }

    try {
      await syncRoomCount(ctx.profile.hotel_id, parsed.data.totalRooms, ctx.userId)
      await ensureOwnerOrganization(
        admin,
        ctx.userId,
        ctx.profile.name ?? 'Owner',
        parsed.data.name.trim(),
        ctx.profile.hotel_id,
      )
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Could not update room count.',
      }
    }

    await advanceStep(ctx.userId, next)
    revalidateAll()
    return { success: true }
  }

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
    await ensureOwnerOrganization(
      admin,
      ctx.userId,
      ctx.profile.name ?? 'Owner',
      parsed.data.name.trim(),
      hotel.id,
    )
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
    .update({ hotel_id: hotel.id, onboarding_step: next })
    .eq('id', ctx.userId)

  if (linkError) {
    return { success: false, error: 'Property created but account link failed.' }
  }

  revalidateAll()
  return { success: true }
}

export async function completeComplianceStep(
  input: unknown,
  resumeStep?: unknown,
): Promise<OnboardingActionResult> {
  const parsed = complianceStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid compliance details.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx?.profile.hotel_id) {
    return { success: false, error: 'Create your property first.' }
  }

  const resume = resumeStepSchema.safeParse(resumeStep).data ?? null
  const next = resolveOnboardingStepAfterComplete('compliance', resume)
  const admin = createAdminClient()
  const { error } = await admin
    .from('hotels')
    .update({
      vat_registration_number: parsed.data.vatRegistrationNumber?.trim() || null,
      vat_mode: parsed.data.vatMode as VatMode,
    })
    .eq('id', ctx.profile.hotel_id)

  if (error) return { success: false, error: error.message }

  await advanceStep(ctx.userId, next)
  revalidateAll()
  return { success: true }
}

export async function completeTeamStep(
  input: unknown,
  resumeStep?: unknown,
): Promise<OnboardingActionResult> {
  const parsed = teamStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const ctx = await requireOnboardingOwner()
  if (!ctx?.profile.hotel_id) {
    return { success: false, error: 'Create your property first.' }
  }

  const resume = resumeStepSchema.safeParse(resumeStep).data ?? null
  const next = resolveOnboardingStepAfterComplete('team', resume)

  const email = parsed.data.managerEmail?.trim()
  if (!parsed.data.skip && email) {
    const invite = await inviteStaff(email, 'manager')
    if (!invite.success) {
      return { success: false, error: invite.error }
    }
  }

  await advanceStep(ctx.userId, next)
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

  try {
    const { data: hotel } = await admin
      .from('hotels')
      .select('name')
      .eq('id', ctx.profile.hotel_id)
      .maybeSingle()

    await ensureOwnerOrganization(
      admin,
      ctx.userId,
      ctx.profile.name ?? 'Owner',
      hotel?.name ?? 'Property',
      ctx.profile.hotel_id,
    )
  } catch (err) {
    console.error('[finishOnboarding] organization provisioning failed:', err)
  }

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
