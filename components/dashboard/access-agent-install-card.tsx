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
    <div className="surface-card">
      {!compact && <div className="surface-card-accent" />}
      <div className="surface-card-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Install on-site agent</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Desktop app for the apartment PC on the same network as the doors. Version{' '}
                {version}. After install, paste the config from Setup → Start setup.
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
                target="_blank"
                rel="noopener noreferrer"
              >
                <Apple className="h-4 w-4" />
                Download for Mac (.dmg)
              </a>
            ) : null}
            {macZip ? (
              <a
                href={macZip}
                className="app-btn app-btn-ghost inline-flex items-center gap-2 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mac (.zip)
              </a>
            ) : null}
            {winSetup ? (
              <a
                href={winSetup}
                className={`app-btn ${preferred === 'windows' ? 'app-btn-primary' : 'app-btn-secondary'} inline-flex items-center gap-2`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Monitor className="h-4 w-4" />
                Download for Windows
              </a>
            ) : null}
            {winPortable && winPortable !== winSetup ? (
              <a
                href={winPortable}
                className="app-btn app-btn-ghost inline-flex items-center gap-2 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Windows (portable)
              </a>
            ) : null}
          </div>
        )}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            Windows: run the setup .exe. Mac: open the .dmg and drag to Applications. Keep the tray
            / menu-bar app running so unlock and enroll jobs can reach the doors.
          </p>
          {macDmg || macZip ? (
            <div className="soft-panel space-y-1.5 p-3 text-foreground">
              <p className="font-semibold">Mac: if macOS says the app is “damaged”</p>
              <p className="text-muted-foreground">
                That is Gatekeeper blocking an unsigned download — the file is fine. After dragging
                to Applications, open <span className="font-medium text-foreground">Terminal</span>{' '}
                and run:
              </p>
              <code className="block break-all rounded-lg bg-background/80 px-2.5 py-2 font-mono text-[11px] text-foreground">
                xattr -cr &quot;/Applications/MOJO Access Agent.app&quot;
              </code>
              <p className="text-muted-foreground">
                Then open the app from Applications (or right-click → Open).
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
