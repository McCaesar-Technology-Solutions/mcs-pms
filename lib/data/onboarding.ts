import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OnboardingStep } from '@/lib/onboarding/state'
import type { VatMode } from '@/types'

export interface OnboardingPropertyDraft {
  name: string
  address: string
  city: string
  region: string
  totalRooms: number
}

export interface OnboardingComplianceDraft {
  vatRegistrationNumber: string
  vatMode: VatMode
}

export interface OnboardingPageData {
  step: OnboardingStep
  ownerName: string
  property?: OnboardingPropertyDraft
  compliance?: OnboardingComplianceDraft
}

export async function getOnboardingPageData(): Promise<OnboardingPageData | null> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') return null
  if (profile.onboarding_completed_at) return null

  const data: OnboardingPageData = {
    step: (profile.onboarding_step ?? 'welcome') as OnboardingStep,
    ownerName: profile.name,
  }

  if (!profile.hotel_id) return data

  const admin = createAdminClient()
  const [{ data: hotel }, { count: roomCount }] = await Promise.all([
    admin
      .from('hotels')
      .select('name, address, city, region, vat_registration_number, vat_mode')
      .eq('id', profile.hotel_id)
      .maybeSingle(),
    admin
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('hotel_id', profile.hotel_id),
  ])

  if (hotel) {
    data.property = {
      name: hotel.name ?? '',
      address: hotel.address ?? '',
      city: hotel.city ?? 'Accra',
      region: hotel.region ?? 'Greater Accra',
      totalRooms: roomCount ?? 0,
    }
    data.compliance = {
      vatRegistrationNumber: hotel.vat_registration_number ?? '',
      vatMode: (hotel.vat_mode as VatMode) ?? 'exclusive',
    }
  }

  return data
}
