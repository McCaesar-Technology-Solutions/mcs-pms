import { Building2 } from 'lucide-react'

export function PropertyThumb({
  imageUrl,
  alt = 'Property photo',
  className = 'h-9 w-9',
}: {
  imageUrl: string | null | undefined
  alt?: string
  className?: string
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={`${className} shrink-0 rounded-lg object-cover shadow-elevation-2`}
      />
    )
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-white/10 shadow-elevation-2`}
    >
      <Building2 className="h-4 w-4 text-[var(--accent)]" />
    </div>
  )
}
