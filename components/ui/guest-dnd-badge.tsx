import { Moon } from 'lucide-react'

interface GuestDndBadgeProps {
  className?: string
  compact?: boolean
}

/** Shown wherever staff view in-house guest details. */
export function GuestDndBadge({ className = '', compact = false }: GuestDndBadgeProps) {
  return (
    <span
      className={`guest-dnd-badge ${compact ? 'guest-dnd-badge--compact' : ''} ${className}`.trim()}
      title="Guest has Do Not Disturb on — call before entering"
    >
      <Moon className="guest-dnd-badge__icon" aria-hidden />
      DND
    </span>
  )
}

export function guestDoNotDisturb(
  guest?: { do_not_disturb?: boolean | null; doNotDisturb?: boolean | null } | null,
): boolean {
  if (!guest) return false
  return Boolean(guest.doNotDisturb ?? guest.do_not_disturb)
}
