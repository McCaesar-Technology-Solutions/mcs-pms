'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check } from 'lucide-react'

interface PortalLinkPanelProps {
  loginUrl: string
  title?: string
  portalPin?: string | null
}

export function PortalLinkPanel({
  loginUrl,
  title = 'Guest portal link',
  portalPin,
}: PortalLinkPanelProps) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(loginUrl, { width: 200 })
      .then(setQr)
      .catch(() => setQr(''))
  }, [loginUrl])

  async function copy() {
    try {
      await navigator.clipboard.writeText(loginUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-emerald-50 p-4 text-center">
      <p className="text-sm font-semibold text-emerald-900">{title}</p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Guest portal QR code" className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
      )}
      <p className="break-all text-xs text-emerald-800/80">{loginUrl}</p>
      {portalPin && (
        <div className="rounded-lg bg-white/70 px-3 py-2">
          <p className="text-xs font-medium text-emerald-900">Portal access PIN</p>
          <p className="font-mono text-xl font-bold tracking-[0.3em] text-emerald-800">
            {portalPin}
          </p>
          <p className="text-[11px] text-emerald-800/70">
            Guests scan the property QR, then sign in with their room number and this PIN. The link
            below is optional for direct access.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
