import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'
import type { AccessJobType, AccessJobPayload } from '@/lib/access/types'
import {
  dedupeAttendanceRows,
  parseAttendancePullRecord,
} from '@/lib/access/attendance-ingest'

const CLAIM_STALE_MS = 5 * 60 * 1000
const BATCH = 20

type Admin = ReturnType<typeof createAdminClient>

export async function isAccessControlEnabled(hotelId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('access_control_enabled')
    .eq('id', hotelId)
    .maybeSingle()

  if (!hotel?.access_control_enabled) return false

  const { data: integration } = await admin
    .from('access_integrations')
    .select('enabled')
    .eq('hotel_id', hotelId)
    .maybeSingle()

  return Boolean(integration?.enabled)
}

export async function enqueueAccessJob(input: {
  hotelId: string
  jobType: AccessJobType
  payload: AccessJobPayload
  credentialId?: string | null
  idempotencyKey?: string
  priority?: number
}): Promise<{ id: string } | { skipped: true } | { error: string }> {
  const admin = createAdminClient()

  if (!(await isAccessControlEnabled(input.hotelId))) {
    return { skipped: true }
  }

  const row = {
    hotel_id: input.hotelId,
    credential_id: input.credentialId ?? null,
    job_type: input.jobType,
    status: 'pending' as const,
    priority: input.priority ?? (input.jobType === 'unlock' ? 10 : 100),
    payload: input.payload as unknown as Json,
    idempotency_key: input.idempotencyKey ?? null,
    next_retry_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from('access_jobs')
      .select('id, status')
      .eq('hotel_id', input.hotelId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()

    if (existing && !['failed', 'dead', 'cancelled'].includes(existing.status)) {
      return { id: existing.id }
    }
  }

  const { data, error } = await admin.from('access_jobs').insert(row).select('id').single()
  if (error || !data) {
    // Unique race on idempotency — treat as success
    if (error?.code === '23505' && input.idempotencyKey) {
      const { data: again } = await admin
        .from('access_jobs')
        .select('id')
        .eq('hotel_id', input.hotelId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle()
      if (again) return { id: again.id }
    }
    return { error: error?.message ?? 'Failed to enqueue access job.' }
  }
  return { id: data.id }
}

export async function claimAccessJobs(input: {
  hotelId: string
  agentId: string
  limit?: number
}): Promise<
  Array<{
    id: string
    job_type: AccessJobType
    credential_id: string | null
    payload: AccessJobPayload
    attempts: number
  }>
> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const limit = Math.min(input.limit ?? BATCH, 50)

  const { data: rows } = await admin
    .from('access_jobs')
    .select('id, job_type, credential_id, payload, attempts, max_attempts, status')
    .eq('hotel_id', input.hotelId)
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (!rows?.length) return []

  const claimed: Array<{
    id: string
    job_type: AccessJobType
    credential_id: string | null
    payload: AccessJobPayload
    attempts: number
  }> = []

  for (const row of rows) {
    const { data: updated, error } = await admin
      .from('access_jobs')
      .update({
        status: 'claimed',
        claimed_at: now,
        claimed_by: input.agentId,
        attempts: row.attempts + 1,
        updated_at: now,
      })
      .eq('id', row.id)
      .in('status', ['pending', 'failed'])
      .select('id, job_type, credential_id, payload, attempts')
      .maybeSingle()

    if (error || !updated) continue

    claimed.push({
      id: updated.id,
      job_type: updated.job_type as AccessJobType,
      credential_id: updated.credential_id,
      payload: updated.payload as AccessJobPayload,
      attempts: updated.attempts,
    })
  }

  return claimed
}

export async function completeAccessJob(input: {
  hotelId: string
  jobId: string
  success: boolean
  result?: Record<string, unknown>
  error?: string
  agentId: string
}): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: job } = await admin
    .from('access_jobs')
    .select('*')
    .eq('id', input.jobId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!job) return { error: 'Job not found.' }
  // Staff cancelled while agent was mid-capture — treat as done, don't overwrite.
  if (job.status === 'cancelled') return { ok: true }
  if (job.status !== 'claimed') return { error: 'Job is not claimed.' }

  if (input.success) {
    if (job.job_type === 'pull_attendance') {
      try {
        await ingestAttendancePull(admin, input.hotelId, input.result)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Attendance ingest failed after device pull.'
        await admin
          .from('access_jobs')
          .update({
            status: 'failed',
            last_error: msg,
            result: (input.result ?? null) as Json | null,
            updated_at: now,
            claimed_at: null,
            claimed_by: null,
            next_retry_at: new Date(Date.now() + 60_000).toISOString(),
          })
          .eq('id', job.id)
        return { ok: true }
      }
    }

    const sanitizedPayload = stripTransientSecrets(job.payload)
    await admin
      .from('access_jobs')
      .update({
        status: 'succeeded',
        result: (input.result ?? {}) as Json,
        last_error: null,
        payload: sanitizedPayload,
        updated_at: now,
      })
      .eq('id', job.id)

    await applyCredentialSuccess(admin, job, input.result)
    return { ok: true }
  }

  const dead = job.attempts >= job.max_attempts
  const backoffMs = Math.min(30_000 * Math.max(1, job.attempts), 15 * 60_000)

  await admin
    .from('access_jobs')
    .update({
      status: dead ? 'dead' : 'failed',
      last_error: input.error ?? 'Agent reported failure',
      next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
      result: (input.result ?? null) as Json | null,
      updated_at: now,
      claimed_at: null,
      claimed_by: null,
    })
    .eq('id', job.id)

  if (job.credential_id) {
    await admin
      .from('access_credentials')
      .update({
        sync_status: 'failed',
        last_error: input.error ?? 'Agent reported failure',
        status: job.job_type === 'revoke' ? 'revoking' : 'error',
        updated_at: now,
      })
      .eq('id', job.credential_id)
  }

  return { ok: true }
}

function stripTransientSecrets(payload: Json): Json {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const next = { ...(payload as Record<string, unknown>) }
  if ('doorPin' in next) next.doorPin = null
  return next as Json
}

async function ingestAttendancePull(
  admin: Admin,
  hotelId: string,
  result?: Record<string, unknown>,
) {
  const records = result?.records
  if (!Array.isArray(records) || !records.length) return

  const deviceKey = typeof result?.deviceKey === 'string' ? result.deviceKey : null
  const parsed = []
  for (const raw of records) {
    const row = parseAttendancePullRecord(raw, deviceKey)
    if (row) parsed.push(row)
  }
  if (!parsed.length) return

  const employeeNos = [...new Set(parsed.map((r) => r.employee_no))]
  const { data: creds } = await admin
    .from('access_credentials')
    .select('id, profile_id, display_name, person_type, employee_no')
    .eq('hotel_id', hotelId)
    .in('employee_no', employeeNos)
    .neq('person_type', 'tenant')

  const byEmployee = new Map<
    string,
    { id: string; profile_id: string | null; display_name: string | null; person_type: string }
  >()
  for (const c of creds ?? []) {
    // Prefer first non-tenant match; skip tenants explicitly.
    if (c.person_type === 'tenant') continue
    if (!byEmployee.has(c.employee_no)) {
      byEmployee.set(c.employee_no, c)
    }
  }

  const rows = dedupeAttendanceRows(
    parsed.map((r) => {
      const cred = byEmployee.get(r.employee_no)
      return {
        hotel_id: hotelId,
        credential_id: cred?.id ?? null,
        profile_id: cred?.profile_id ?? null,
        employee_no: r.employee_no,
        display_name: r.display_name ?? cred?.display_name ?? null,
        event_type: r.event_type,
        occurred_at: r.occurred_at,
        device_key: r.device_key,
        raw_ref: r.raw_ref,
      }
    }),
  )

  if (!rows.length) return

  // Unique index idx_attendance_records_natural — re-pull is idempotent.
  const { error } = await admin.from('attendance_records').upsert(rows, {
    onConflict: 'hotel_id,employee_no,occurred_at,event_type,device_key',
    ignoreDuplicates: true,
  })
  if (error) {
    // Fallback: insert one-by-one ignoring conflicts (older DBs without unique index).
    for (const row of rows) {
      const { error: insertError } = await admin.from('attendance_records').insert(row)
      if (insertError && !/duplicate|unique/i.test(insertError.message)) {
        throw new Error(insertError.message)
      }
    }
  }
}

async function applyCredentialSuccess(
  admin: Admin,
  job: { job_type: string; credential_id: string | null },
  result?: Record<string, unknown>,
) {
  if (!job.credential_id) return
  const now = new Date().toISOString()

  if (job.job_type === 'revoke') {
    await admin
      .from('access_credentials')
      .update({
        status: 'revoked',
        sync_status: 'synced',
        last_error: null,
        last_synced_at: now,
        updated_at: now,
      })
      .eq('id', job.credential_id)
    return
  }

  if (
    job.job_type === 'provision' ||
    job.job_type === 'update_validity' ||
    job.job_type === 'assign_card' ||
    job.job_type === 'enroll_card_capture' ||
    job.job_type === 'enroll_face_capture' ||
    job.job_type === 'enroll_fingerprint_capture'
  ) {
    const patch: {
      status: 'active'
      sync_status: 'synced'
      last_error: null
      last_synced_at: string
      updated_at: string
      card_no?: string
      has_face?: boolean
      has_fingerprint?: boolean
    } = {
      status: 'active',
      sync_status: 'synced',
      last_error: null,
      last_synced_at: now,
      updated_at: now,
    }
    if (job.job_type === 'enroll_card_capture' && typeof result?.cardNo === 'string' && result.cardNo) {
      patch.card_no = result.cardNo
    }
    if (job.job_type === 'enroll_face_capture' && result?.hasFace) {
      patch.has_face = true
    }
    if (job.job_type === 'enroll_fingerprint_capture' && result?.hasFingerprint) {
      patch.has_fingerprint = true
    }
    await admin.from('access_credentials').update(patch).eq('id', job.credential_id)
  }
}

const CANCELLABLE_STATUSES = ['pending', 'failed', 'claimed'] as const

/** Cancel one open job so the agent will not (re)try it. */
export async function cancelAccessJob(input: {
  hotelId: string
  jobId: string
}): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: job } = await admin
    .from('access_jobs')
    .select('id, status')
    .eq('id', input.jobId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!job) return { error: 'Job not found.' }
  if (!CANCELLABLE_STATUSES.includes(job.status as (typeof CANCELLABLE_STATUSES)[number])) {
    return { error: `Cannot cancel a job with status “${job.status}”.` }
  }

  const { error } = await admin
    .from('access_jobs')
    .update({
      status: 'cancelled',
      last_error: 'Cancelled by staff',
      next_retry_at: now,
      claimed_at: null,
      claimed_by: null,
      updated_at: now,
    })
    .eq('id', job.id)
    .eq('hotel_id', input.hotelId)
    .in('status', [...CANCELLABLE_STATUSES])

  if (error) return { error: error.message }
  return { ok: true }
}

/** Cancel all pending / failed / claimed jobs for a property (stops retry storms). */
export async function cancelOpenAccessJobs(input: {
  hotelId: string
}): Promise<{ ok: true; count: number } | { error: string }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('access_jobs')
    .update({
      status: 'cancelled',
      last_error: 'Cancelled by staff',
      next_retry_at: now,
      claimed_at: null,
      claimed_by: null,
      updated_at: now,
    })
    .eq('hotel_id', input.hotelId)
    .in('status', [...CANCELLABLE_STATUSES])
    .select('id')

  if (error) return { error: error.message }
  return { ok: true, count: data?.length ?? 0 }
}

/** Delete job rows from Recent jobs (history + open). Stops retries by removing them. */
export async function clearAccessJobs(input: {
  hotelId: string
}): Promise<{ ok: true; count: number } | { error: string }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('access_jobs')
    .delete()
    .eq('hotel_id', input.hotelId)
    .select('id')

  if (error) return { error: error.message }
  return { ok: true, count: data?.length ?? 0 }
}

/** Reclaim jobs stuck in claimed (agent crash) and cancel abandoned unlocks. */
export async function reclaimStaleAccessJobs(): Promise<{ reclaimed: number }> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - CLAIM_STALE_MS).toISOString()
  const now = new Date().toISOString()

  const { data } = await admin
    .from('access_jobs')
    .update({
      status: 'failed',
      last_error: 'Claim timed out — agent did not complete the job',
      next_retry_at: now,
      claimed_at: null,
      claimed_by: null,
      updated_at: now,
    })
    .eq('status', 'claimed')
    .lt('claimed_at', cutoff)
    .select('id')

  return { reclaimed: data?.length ?? 0 }
}
