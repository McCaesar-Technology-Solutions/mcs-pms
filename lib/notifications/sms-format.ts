import { appUrl } from '@/lib/notifications/app-url'

/** Compact URL for SMS (no https:// — handsets linkify the host). */
export function smsUrl(path: string): string {
  return appUrl(path).replace(/^https?:\/\//, '')
}

export function smsGuestEnterUrl(token: string): string {
  return smsUrl(`/guest/enter?t=${encodeURIComponent(token)}`)
}

export function smsInviteUrl(token: string): string {
  return smsUrl(`/accept-invite?t=${encodeURIComponent(token)}`)
}

/** e.g. 26 Jun — omit year to save characters. */
export function smsShortDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function smsRoom(roomNumber: string | null | undefined): string {
  return roomNumber ? `Rm ${roomNumber}` : 'Rm TBC'
}

export function smsTruncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Join SMS parts with spaces — keeps messages in one GSM segment when possible. */
export function smsLine(...parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(' ')
}
