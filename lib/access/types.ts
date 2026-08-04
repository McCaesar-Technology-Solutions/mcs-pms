import type { Json } from '@/lib/supabase/types'

export type AccessJobType =
  | 'provision'
  | 'revoke'
  | 'update_validity'
  | 'assign_card'
  | 'unlock'
  | 'sync_device'

export type AccessJobStatus =
  | 'pending'
  | 'claimed'
  | 'succeeded'
  | 'failed'
  | 'dead'
  | 'cancelled'

export type AccessCredentialStatus = 'pending' | 'active' | 'revoking' | 'revoked' | 'error'
export type AccessSyncStatus = 'pending' | 'synced' | 'failed'
export type AccessZone = 'unit' | 'lobby' | 'gate' | 'elevator' | 'other'
export type DeviceCredentialMode = 'local' | 'cloud'

export interface AccessDoorTarget {
  deviceKey: string
  doorNo: number
  label: string
  zone: AccessZone
}

export interface ProvisionJobPayload {
  credentialId: string
  employeeNo: string
  displayName: string
  cardNo?: string | null
  /** Transient — cleared from DB after successful agent completion. */
  doorPin?: string | null
  validFrom: string
  validTo: string
  doors: AccessDoorTarget[]
}

export interface RevokeJobPayload {
  credentialId: string
  employeeNo: string
}

export interface UpdateValidityJobPayload {
  credentialId: string
  employeeNo: string
  validFrom: string
  validTo: string
}

export interface AssignCardJobPayload {
  credentialId: string
  employeeNo: string
  cardNo: string
  doorPin?: string | null
  doors: AccessDoorTarget[]
}

export interface UnlockJobPayload {
  deviceKey: string
  doorNo: number
  label: string
  reason?: string
  requestedByProfileId?: string
}

export type AccessJobPayload =
  | ProvisionJobPayload
  | RevokeJobPayload
  | UpdateValidityJobPayload
  | AssignCardJobPayload
  | UnlockJobPayload
  | Record<string, unknown>

export interface AccessJobRow {
  id: string
  hotel_id: string
  credential_id: string | null
  job_type: AccessJobType
  status: AccessJobStatus
  priority: number
  payload: Json
  result: Json | null
  idempotency_key: string | null
  attempts: number
  max_attempts: number
  next_retry_at: string
  claimed_at: string | null
  claimed_by: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface AccessIntegrationSummary {
  hotelId: string
  enabled: boolean
  hotelFlagEnabled: boolean
  hasAgentToken: boolean
  agentTokenPrefix: string | null
  agentLastSeenAt: string | null
  agentVersion: string | null
  agentHostname: string | null
  agentOnline: boolean
  /** local = passwords in agent .env; cloud = passwords stored encrypted in MOJO */
  deviceCredentialMode: DeviceCredentialMode
}

/** Safe for staff UI — never includes password. */
export interface AccessDeviceRow {
  id: string
  hotel_id: string
  device_key: string
  label: string
  host: string | null
  port: number | null
  username: string | null
  use_https: boolean
  managed_in_cloud: boolean
  is_online: boolean
  last_seen_at: string | null
  has_password: boolean
}

export interface AccessPointRow {
  id: string
  hotel_id: string
  device_key: string
  door_no: number
  label: string
  zone: AccessZone
  room_id: string | null
  grants_shared_access: boolean
  is_active: boolean
  room_number?: string | null
}

export interface AccessCredentialRow {
  id: string
  hotel_id: string
  guest_id: string | null
  reservation_id: string | null
  employee_no: string
  display_name: string
  card_no: string | null
  has_pin: boolean
  valid_from: string
  valid_to: string
  status: AccessCredentialStatus
  sync_status: AccessSyncStatus
  last_error: string | null
  last_synced_at: string | null
  guest_name?: string | null
  room_number?: string | null
}
