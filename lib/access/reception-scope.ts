import type { AccessJobType } from '@/lib/access/types'

/** Job types Reception may see when tied to a tenant credential (or unlock). */
const RECEPTION_CREDENTIAL_JOB_TYPES = new Set<AccessJobType>([
  'provision',
  'revoke',
  'update_validity',
  'assign_card',
  'enroll_card_capture',
  'enroll_face_capture',
  'enroll_fingerprint_capture',
])

/**
 * Whether a job should appear in Reception's Recent jobs list.
 * Unlock is always guest-facing. Credential jobs require person_type === tenant.
 */
export function isReceptionVisibleJob(input: {
  jobType: string
  credentialId: string | null
  personType?: string | null
}): boolean {
  if (input.jobType === 'unlock') return true
  if (input.jobType === 'pull_attendance' || input.jobType === 'sync_device') return false
  if (!input.credentialId) return false
  if (!RECEPTION_CREDENTIAL_JOB_TYPES.has(input.jobType as AccessJobType)) return false
  return input.personType === 'tenant'
}

/** Reception may cancel only unlock or tenant-credential jobs. */
export function receptionMayCancelJob(input: {
  jobType: string
  credentialId: string | null
  personType?: string | null
}): boolean {
  return isReceptionVisibleJob(input)
}
