'use client'

import { Camera } from 'lucide-react'
import { ProfilePhotoUpload } from '@/components/profile/profile-photo-upload'
import { clearMyProfilePhoto, uploadMyProfilePhoto } from '@/app/actions/profile-photo'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
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
  const imagePath = (profile as Profile & { profile_image_path?: string | null }).profile_image_path

  return (
    <CenteredModal open={open} onClose={onClose} className="max-w-md" aria-label="Profile photo">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Camera className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Profile photo</h2>
            <p className="text-sm text-muted-foreground">
              Crop your photo — it appears in team and guest messages.
            </p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
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
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-secondary">
          Done
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

export function profileAvatarUrl(profile: Profile | null | undefined): string | null {
  if (!profile) return null
  const path = (profile as Profile & { profile_image_path?: string | null }).profile_image_path
  return profilePhotoPublicUrl(path)
}
