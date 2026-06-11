'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check } from 'lucide-react'

interface PortalLinkPanelProps {
  loginUrl: string
  title?: string
}

export function PortalLinkPanel({ loginUrl, title = 'Guest portal link' }: PortalLinkPanelProps) {
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
