'use client'

import { ProfilePhoneEditor } from '@/components/dashboard/profile-phone-editor'

interface ProfilePhoneBannerProps {
  roleLabel: string
  initialPhone?: string | null
}

export function ProfilePhoneBanner({ roleLabel, initialPhone }: ProfilePhoneBannerProps) {
  if (initialPhone) return null

  return <ProfilePhoneEditor roleLabel={roleLabel} variant="banner" />
}
