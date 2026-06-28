'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'

interface ProfilePhotoUploadProps {
  name: string
  imagePath: string | null | undefined
  onUpload: (formData: FormData) => Promise<{ success: boolean; error?: string; imageUrl?: string }>
  onClear: () => Promise<{ success: boolean; error?: string }>
  hint?: string
  compact?: boolean
}

export function ProfilePhotoUpload({
  name,
  imagePath,
  onUpload,
  onClear,
  hint = 'Shown in messages so the team knows who they are chatting with.',
  compact = false,
}: ProfilePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(profilePhotoPublicUrl(imagePath))
  const [pending, startTransition] = useTransition()

  function onFileChange(file: File | null) {
    if (!file) return
    const formData = new FormData()
    formData.set('file', file)
    startTransition(async () => {
      const result = await onUpload(formData)
      if (result.success && result.imageUrl) {
        setPreviewUrl(result.imageUrl)
        toast.success('Profile photo updated')
      } else if (!result.success) {
        toast.error(result.error ?? 'Upload failed')
      }
    })
  }

  function removePhoto() {
    startTransition(async () => {
      const result = await onClear()
      if (result.success) {
        setPreviewUrl(null)
        toast.success('Photo removed')
      } else if (!result.success) {
        toast.error(result.error ?? 'Could not remove photo')
      }
    })
  }

  return (
    <div className={`profile-photo-upload ${compact ? 'profile-photo-upload--compact' : ''}`}>
      <div className="profile-photo-upload__frame">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={`${name} profile photo`}
            fill
            className="object-cover"
            sizes="120px"
          />
        ) : (
          <div className="profile-photo-upload__placeholder">
            <Camera className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">No photo</span>
          </div>
        )}
        {pending && (
          <div className="profile-photo-upload__loading">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="profile-photo-upload__body">
        {!compact && <p className="text-sm font-semibold text-foreground">Profile photo</p>}
        {!compact && hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        <div className="profile-photo-upload__actions">
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="profile-photo-upload__btn"
          >
            {previewUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {previewUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={removePhoto}
              className="profile-photo-upload__btn profile-photo-upload__btn--danger"
              aria-label="Remove profile photo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </div>
  )
}
