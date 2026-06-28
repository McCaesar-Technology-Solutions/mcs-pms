'use client'

import Image from 'next/image'
import { useCallback, useRef, useState, useTransition } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCroppedImageBlob } from '@/lib/images/crop'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'

interface ProfilePhotoUploadProps {
  name: string
  imagePath: string | null | undefined
  onUpload: (formData: FormData) => Promise<{ success: boolean; error?: string; imageUrl?: string }>
  onClear: () => Promise<{ success: boolean; error?: string }>
  hint?: string
  compact?: boolean
  className?: string
}

export function ProfilePhotoUpload({
  name,
  imagePath,
  onUpload,
  onClear,
  hint = 'Shown in messages so the team knows who they are chatting with.',
  compact = false,
  className = '',
}: ProfilePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(profilePhotoPublicUrl(imagePath))
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null)
  const [cropError, setCropError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const uploadBlob = useCallback(
    (blob: Blob) => {
      const formData = new FormData()
      formData.set('file', blob, 'profile.jpg')
      startTransition(async () => {
        const result = await onUpload(formData)
        if (result.success && result.imageUrl) {
          setPreviewUrl(result.imageUrl)
          toast.success('Profile photo updated')
        } else if (!result.success) {
          toast.error(result.error ?? 'Upload failed')
        }
      })
    },
    [onUpload],
  )

  function onFileChange(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCropError('Please choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCropError('Image must be 5 MB or smaller.')
      return
    }
    setCropError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  async function applyCrop() {
    if (!imageSrc || !croppedPixels) return
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedPixels)
      setImageSrc(null)
      setPreviewUrl(URL.createObjectURL(blob))
      uploadBlob(blob)
    } catch {
      setCropError('Could not crop image. Try another file.')
    }
  }

  function cancelCrop() {
    setImageSrc(null)
    setCropError(null)
    setCroppedPixels(null)
  }

  function removePhoto() {
    startTransition(async () => {
      const result = await onClear()
      if (result.success) {
        setPreviewUrl(null)
        setImageSrc(null)
        toast.success('Photo removed')
      } else if (!result.success) {
        toast.error(result.error ?? 'Could not remove photo')
      }
    })
  }

  return (
    <div className={`profile-photo-upload ${compact ? 'profile-photo-upload--compact' : ''} ${className}`.trim()}>
      <div className="profile-photo-upload__frame">
        {previewUrl && !imageSrc ? (
          <Image
            src={previewUrl}
            alt={`${name} profile photo`}
            fill
            className="object-cover"
            sizes="120px"
          />
        ) : !imageSrc ? (
          <div className="profile-photo-upload__placeholder">
            <Camera className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">No photo</span>
          </div>
        ) : null}
        {pending && (
          <div className="profile-photo-upload__loading">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="profile-photo-upload__body">
        {!compact && <p className="text-sm font-semibold text-foreground">Profile photo</p>}
        {!compact && hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        {compact && hint && <p className="text-xs leading-relaxed guest-text-muted">{hint}</p>}

        {imageSrc && (
          <div className="mt-3 space-y-3">
            <div className="relative h-48 overflow-hidden rounded-xl bg-[#1a1330]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedPixels(pixels)}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
              aria-label="Zoom photo"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void applyCrop()}
                disabled={pending || !croppedPixels}
                className="app-btn app-btn-primary"
              >
                Apply &amp; save
              </button>
              <button type="button" onClick={cancelCrop} disabled={pending} className="app-btn app-btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!imageSrc && (
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
        )}

        {cropError && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {cropError}
          </p>
        )}
      </div>
    </div>
  )
}
