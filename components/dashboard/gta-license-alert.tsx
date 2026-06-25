'use client'

import { AlertTriangle } from 'lucide-react'
import type { GtaLicenseCheck } from '@/lib/compliance/gta-license'

const STYLE: Record<GtaLicenseCheck['status'], string> = {
  valid: '',
  missing: 'border-amber-200 bg-amber-50 text-amber-900',
  expiring_soon: 'border-amber-200 bg-amber-50 text-amber-900',
  expiring_critical: 'border-red-200 bg-red-50 text-red-900',
  expired: 'border-red-300 bg-red-100 text-red-950',
}

export function GtaLicenseAlert({ check }: { check: GtaLicenseCheck }) {
  if (check.status === 'valid' || !check.message) return null

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${STYLE[check.status]}`}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">GTA license compliance</p>
        <p className="mt-1 text-sm">{check.message}</p>
        {check.licenseNumber && (
          <p className="mt-1 text-xs opacity-80">License: {check.licenseNumber}</p>
        )}
      </div>
    </div>
  )
}
