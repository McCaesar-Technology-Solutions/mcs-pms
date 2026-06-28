import type { UserRole } from '@/types'

/** Public-facing role labels on guest and technician contact lists. */
export const STAFF_CONTACT_ROLE_LABEL: Partial<Record<UserRole, string>> = {
  manager: 'Manager',
  receptionist: 'Front desk',
  technician: 'Maintenance',
}

/** Label for phone contact rows: "Name · Role". Owners are never listed for guests. */
export function staffContactLabel(name: string, role: UserRole): string {
  const title = STAFF_CONTACT_ROLE_LABEL[role]
  return title ? `${name} · ${title}` : name
}

/** How staff appear in guest-facing chat (never expose owner identity). */
export function guestFacingAuthorName(
  name: string | null | undefined,
  role: UserRole | string | null | undefined,
): string {
  if (role === 'owner') return 'Property team'
  if (!name?.trim()) return 'Front desk'
  const title = role ? STAFF_CONTACT_ROLE_LABEL[role as UserRole] : undefined
  return title ? `${name.trim()} · ${title}` : name.trim()
}
