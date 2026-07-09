'use client'

/**
 * After a new production deploy, browser tabs still running the old bundle
 * fail every server-action call ("Failed to find Server Action", "unexpected
 * response was received from the server"). The only fix is a full reload to
 * pick up the new bundle — do it once, guarded against loops.
 */

const RELOAD_FLAG = 'stale-deploy-reloaded-at'
const RELOAD_COOLDOWN_MS = 60_000

export function isStaleDeploymentError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('failed to find server action') ||
    msg.includes('unexpected response was received from the server') ||
    msg.includes('failed to fetch')
  )
}

export function reloadOnceForStaleDeployment(): void {
  if (typeof window === 'undefined') return
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch {
    // sessionStorage unavailable — reload anyway, cooldown just won't apply
  }
  window.location.reload()
}

/** Handle a failed background refresh: reload for stale deploys, log otherwise. */
export function handleBackgroundRefreshError(scope: string, err: unknown): void {
  if (isStaleDeploymentError(err)) {
    console.warn(`[${scope}] stale deployment detected — reloading`)
    reloadOnceForStaleDeployment()
    return
  }
  console.error(`[${scope}] background refresh failed:`, err)
}
