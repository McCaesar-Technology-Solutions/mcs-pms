'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, QrCode } from 'lucide-react'
import { getStaffPropertyPortalInfo } from '@/app/actions/guest-portal'

export function PropertyPortalQrPanel() {
  const [joinUrl, setJoinUrl] = useState('')
  const [hotelName, setHotelName] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getStaffPropertyPortalInfo()
    setLoading(false)
    if (!result.success || !result.data) {
      setError(result.success ? 'Could not load portal link.' : result.error)
      return
    }
    setJoinUrl(result.data.joinUrl)
    setHotelName(result.data.hotelName)
    try {
      const qr = await QRCode.toDataURL(result.data.joinUrl, { width: 280, margin: 2 })
      setQrDataUrl(qr)
    } catch {
      setQrDataUrl('')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function copyLink() {
    if (!joinUrl) return
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${hotelName.replace(/\s+/g, '-').toLowerCase()}-guest-portal-qr.png`
    link.click()
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-elevation-1">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3C216C]/10">
          <QrCode className="h-5 w-5 text-[#3C216C]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Property guest portal QR</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Print this QR in the lobby or on room doors. Guests scan it, enter their room number, and
            open the portal — no personal link required.
          </p>
        </div>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-muted-foreground">Loading portal link…</p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && joinUrl && (
        <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="Property guest portal QR code"
              className="h-44 w-44 rounded-xl border border-[#E9ECEF] bg-white p-2 shadow-elevation-1"
            />
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Join link
            </p>
            <p className="break-all rounded-xl bg-[#F7F4FB] px-3 py-2.5 text-sm font-medium text-[#3C216C]">
              {joinUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white shadow-elevation-1 hover:shadow-elevation-2"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {qrDataUrl && (
                <button
                  type="button"
                  onClick={downloadQr}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E9ECEF] bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-elevation-1 hover:shadow-elevation-2"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
