'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ImagePlus, X } from 'lucide-react'
import { getCroppedImageBlob } from '@/lib/images/crop'

interface PropertyImageCropFieldProps {
  value: Blob | null
  onChange: (blob: Blob | null) => void
  disabled?: boolean
}

export function PropertyImageCropField({ value, onChange, disabled }: PropertyImageCropFieldProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clear = useCallback(() => {
    setImageSrc(null)
    setPreviewUrl(null)
    setCroppedPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    onChange(null)
  }, [onChange])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.')
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setPreviewUrl(null)
      onChange(null)
    }
    reader.readAsDataURL(file)
  }

  const applyCrop = async () => {
    if (!imageSrc || !croppedPixels) return
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedPixels)
      setPreviewUrl(URL.createObjectURL(blob))
      onChange(blob)
      setImageSrc(null)
    } catch {
      setError('Could not crop image. Try another file.')
    }
  }

  return (
    <div>
      <label className="text-sm font-semibold">Property photo</label>
      <p className="mt-1 text-xs text-muted-foreground">
        Square crop shown in your portfolio and sidebar. Optional.
      </p>

      {previewUrl && !imageSrc && (
        <div className="mt-3 flex items-start gap-3">
          <img
            src={previewUrl}
            alt="Property preview"
            className="h-20 w-20 rounded-xl object-cover shadow-elevation-1"
          />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Remove
          </button>
        </div>
      )}

      {imageSrc && (
        <div className="mt-3 space-y-3">
          <div className="relative h-52 overflow-hidden rounded-xl bg-[#1a1330]">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
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
            aria-label="Zoom"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyCrop()}
              disabled={disabled || !croppedPixels}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Apply crop
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!imageSrc && !previewUrl && (
        <label
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#E9ECEF] bg-[#FAFDFF] px-4 py-6 transition-colors hover:bg-white ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <ImagePlus className="mb-2 h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Upload photo</span>
          <span className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP · max 5 MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled}
            onChange={onFileChange}
          />
        </label>
      )}

      {!imageSrc && previewUrl && !value && (
        <label className="mt-2 inline-flex cursor-pointer text-sm font-semibold text-primary hover:underline">
          Replace photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled}
            onChange={onFileChange}
          />
        </label>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
