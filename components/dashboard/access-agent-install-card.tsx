'use client'

import { useMemo } from 'react'
import { Apple, Download, Monitor } from 'lucide-react'
import {
  ACCESS_AGENT_VERSION,
  type AccessAgentDownloadLinks,
} from '@/lib/access/agent-downloads'

type Props = {
  links?: AccessAgentDownloadLinks
  compact?: boolean
}

function detectPreferred(): 'mac' | 'windows' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/Mac|iPhone|iPad/i.test(ua)) return 'mac'
  if (/Win/i.test(ua)) return 'windows'
  return 'other'
}

export function AccessAgentInstallCard({ links, compact = false }: Props) {
  const preferred = useMemo(() => detectPreferred(), [])
  const version = links?.version ?? ACCESS_AGENT_VERSION
  const macDmg = links?.macDmg
  const macZip = links?.macZip
  const winSetup = links?.windowsSetup
  const winPortable = links?.windowsPortable

  const hasAny = Boolean(macDmg || macZip || winSetup || winPortable)

  return (
    <div className="surface-card overflow-hidden">
      {!compact && <div className="surface-card-accent" />}
      <div className="surface-card-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Install Access Agent</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Desktop app for the apartment PC (same LAN as the doors). Version {version}.
                After install, paste the config from Owner → Access → Start setup.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="surface-card-body space-y-3">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">
            Download links are not configured yet. Ask the owner to publish installers or set
            NEXT_PUBLIC_ACCESS_AGENT_* URLs.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {macDmg ? (
              <a
                href={macDmg}
                className={`app-btn ${preferred === 'mac' ? 'app-btn-primary' : 'app-btn-secondary'} inline-flex items-center gap-2`}
                download
              >
                <Apple className="h-4 w-4" />
                Download for Mac (.dmg)
              </a>
            ) : null}
            {macZip ? (
              <a
                href={macZip}
                className="app-btn app-btn-ghost inline-flex items-center gap-2 text-xs"
                download
              >
                Mac (.zip)
              </a>
            ) : null}
            {winSetup ? (
              <a
                href={winSetup}
                className={`app-btn ${preferred === 'windows' ? 'app-btn-primary' : 'app-btn-secondary'} inline-flex items-center gap-2`}
                download
              >
                <Monitor className="h-4 w-4" />
                Download for Windows
              </a>
            ) : null}
            {winPortable && winPortable !== winSetup ? (
              <a
                href={winPortable}
                className="app-btn app-btn-ghost inline-flex items-center gap-2 text-xs"
                download
              >
                Windows (portable)
              </a>
            ) : null}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Mac: open the .dmg and drag to Applications. Windows: run the setup .exe. Keep the tray
          app running so unlock and enroll jobs can reach the doors.
        </p>
      </div>
    </div>
  )
}
