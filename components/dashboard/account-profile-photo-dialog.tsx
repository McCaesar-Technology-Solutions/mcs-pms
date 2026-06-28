'use client'

import { Camera } from 'lucide-react'
import { ProfilePhotoUpload } from '@/components/profile/profile-photo-upload'
import { clearMyProfilePhoto, uploadMyProfilePhoto } from '@/app/actions/profile-photo'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'
import type { Profile } from '@/types'

interface AccountProfilePhotoDialogProps {
  open: boolean
  onClose: () => void
  profile: Profile
}

export function AccountProfilePhotoDialog({
  open,
  onClose,
  profile,
}: AccountProfilePhotoDialogProps) {
  if (!open) return null

  const imagePath = (profile as Profile & { profile_image_path?: string | null }).profile_image_path

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close profile photo dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="profile-photo-title"
        className="relative z-[1] w-full max-w-md rounded-2xl border border-border/60 bg-white p-5 shadow-elevation-3"
      >
        <div className="mb-4 flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 id="profile-photo-title" className="text-base font-semibold text-foreground">
            Profile photo
          </h2>
        </div>
        <ProfilePhotoUpload
          name={profile.name}
          imagePath={imagePath}
          onUpload={async (formData) => {
            const result = await uploadMyProfilePhoto(formData)
            if (result.success && result.data) {
              return { success: true, imageUrl: result.data.imageUrl }
            }
            return { success: false, error: !result.success ? result.error : undefined }
          }}
          onClear={async () => {
            const result = await clearMyProfilePhoto()
            return { success: result.success, error: !result.success ? result.error : undefined }
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary/60"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function profileAvatarUrl(profile: Profile | null | undefined): string | null {
  if (!profile) return null
  const path = (profile as Profile & { profile_image_path?: string | null }).profile_image_path
  return profilePhotoPublicUrl(path)
}
