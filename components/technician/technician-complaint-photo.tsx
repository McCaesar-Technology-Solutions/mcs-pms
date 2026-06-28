'use client'

import { useEffect, useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { getTechnicianComplaintPhotoUrl } from '@/app/actions/complaints'

interface TechnicianComplaintPhotoProps {
  complaintId: string
  hasPhoto: boolean
}

export function TechnicianComplaintPhoto({ complaintId, hasPhoto }: TechnicianComplaintPhotoProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!hasPhoto) return
    let cancelled = false
    setLoading(true)
    setError(false)
    void getTechnicianComplaintPhotoUrl(complaintId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.success && result.data?.url) {
        setUrl(result.data.url)
      } else {
        setError(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [complaintId, hasPhoto])

  if (!hasPhoto) return null

  return (
    <div className="technician-detail-card overflow-hidden p-0">
      <p className="technician-eyebrow border-b border-[var(--tech-border)] px-3 py-2">
        Guest photo
      </p>
      <div className="flex min-h-[180px] items-center justify-center bg-muted p-2">
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <p className="text-xs">Could not load photo</p>
          </div>
        )}
        {!loading && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Guest issue photo"
            className="max-h-64 w-full rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  )
}
