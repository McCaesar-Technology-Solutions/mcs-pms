/**
 * Download URLs for MOJO Access Agent installers.
 * Defaults: GitHub Release assets on McCaesar-Technology-Solutions/mcs-pms.
 * Override with NEXT_PUBLIC_ACCESS_AGENT_*_URL (CDN / other host).
 */

export const ACCESS_AGENT_VERSION =
  process.env.NEXT_PUBLIC_ACCESS_AGENT_VERSION?.trim() || '1.3.7'

const GITHUB_RELEASE_TAG =
  process.env.NEXT_PUBLIC_ACCESS_AGENT_RELEASE_TAG?.trim() ||
  `access-agent-v${ACCESS_AGENT_VERSION}`

const GITHUB_RELEASE_BASE =
  process.env.NEXT_PUBLIC_ACCESS_AGENT_RELEASE_BASE?.trim() ||
  `https://github.com/McCaesar-Technology-Solutions/mcs-pms/releases/download/${GITHUB_RELEASE_TAG}`

export type AccessAgentDownloadLinks = {
  version: string
  macDmg: string | null
  macZip: string | null
  windowsSetup: string | null
  windowsPortable: string | null
}

function envUrl(name: string): string | null {
  const v = process.env[name]?.trim()
  return v || null
}

function releaseAsset(filename: string): string {
  return `${GITHUB_RELEASE_BASE}/${filename}`
}

export function getAccessAgentDownloadLinks(): AccessAgentDownloadLinks {
  return {
    version: ACCESS_AGENT_VERSION,
    macDmg:
      envUrl('NEXT_PUBLIC_ACCESS_AGENT_MAC_DMG_URL') ??
      releaseAsset('MOJO-Access-Agent-mac.dmg'),
    macZip:
      envUrl('NEXT_PUBLIC_ACCESS_AGENT_MAC_ZIP_URL') ??
      releaseAsset('MOJO-Access-Agent-mac.zip'),
    windowsSetup:
      envUrl('NEXT_PUBLIC_ACCESS_AGENT_WIN_SETUP_URL') ??
      releaseAsset('MOJO-Access-Agent-windows-setup.exe'),
    windowsPortable:
      envUrl('NEXT_PUBLIC_ACCESS_AGENT_WIN_PORTABLE_URL') ??
      releaseAsset('MOJO-Access-Agent-windows.exe'),
  }
}
