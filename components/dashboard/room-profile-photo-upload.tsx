'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { clearRoomProfileImage, uploadRoomProfileImage } from '@/app/actions/rooms'
import { roomImagePublicUrl } from '@/lib/rooms/image-storage'

interface RoomProfilePhotoUploadProps {
  roomId: string
  imagePath: string | null | undefined
  roomNumber: string
  canEdit?: boolean
}

export function RoomProfilePhotoUpload({
  roomId,
  imagePath,
  roomNumber,
  canEdit = true,
}: RoomProfilePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(roomImagePublicUrl(imagePath))
  const [pending, startTransition] = useTransition()

  function onFileChange(file: File | null) {
    if (!file || !canEdit) return
    const formData = new FormData()
    formData.set('file', file)
    startTransition(async () => {
      const result = await uploadRoomProfileImage(roomId, formData)
      if (result.success && result.data) {
        setPreviewUrl(result.data.imageUrl)
        toast.success('Room photo updated')
      } else if (!result.success) {
        toast.error(result.error ?? 'Upload failed')
      }
    })
  }

  function removePhoto() {
    if (!canEdit) return
    startTransition(async () => {
      const result = await clearRoomProfileImage(roomId)
      if (result.success) {
        setPreviewUrl(null)
        toast.success('Photo removed')
      } else if (!result.success) {
        toast.error(result.error ?? 'Could not remove photo')
      }
    })
  }

  return (
    <div className="room-photo-upload">
      <div className="room-photo-upload__frame">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={`Room ${roomNumber} photo`}
            fill
            className="object-cover"
            sizes="120px"
          />
        ) : (
          <div className="room-photo-upload__placeholder">
            <Camera className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">No photo</span>
          </div>
        )}
        {pending && (
          <div className="room-photo-upload__loading">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      {canEdit && (
        <div className="room-photo-upload__actions">
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="room-photo-upload__btn"
          >
            {previewUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {previewUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={removePhoto}
              className="room-photo-upload__btn room-photo-upload__btn--danger"
              aria-label="Remove room photo"
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
    </div>
  )
}
