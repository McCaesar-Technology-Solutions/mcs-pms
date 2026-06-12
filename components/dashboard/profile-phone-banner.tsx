'use client'

import { ProfilePhoneEditor } from '@/components/dashboard/profile-phone-editor'

import { hasPhoneNumber } from '@/lib/phone'

interface ProfilePhoneBannerProps {
  roleLabel: string
  initialPhone?: string | null
}

export function ProfilePhoneBanner({ roleLabel, initialPhone }: ProfilePhoneBannerProps) {
  if (hasPhoneNumber(initialPhone)) return null

  return <ProfilePhoneEditor roleLabel={roleLabel} variant="banner" />
}
