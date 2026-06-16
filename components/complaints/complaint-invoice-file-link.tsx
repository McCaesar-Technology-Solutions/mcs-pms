'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { getComplaintInvoiceDownloadUrl } from '@/app/actions/complaint-estimates'

interface ComplaintInvoiceFileLinkProps {
  complaintId: string
  fileName: string
}

export function ComplaintInvoiceFileLink({ complaintId, fileName }: ComplaintInvoiceFileLinkProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    const result = await getComplaintInvoiceDownloadUrl(complaintId)
    setLoading(false)
    if (!result.success) {
      setError('error' in result ? result.error : 'Could not open file.')
      return
    }
    if (!result.data) {
      setError('Could not open file.')
      return
    }
    window.open(result.data.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Uploaded invoice
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-[#3C216C]" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {fileName}
        </span>
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3C216C]/10 px-3 py-1.5 text-xs font-semibold text-[#3C216C] hover:bg-[#3C216C]/15 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {loading ? 'Opening…' : 'View / download'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
