import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'
import type { AccessJobType, AccessJobPayload } from '@/lib/access/types'

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
  if (job.status !== 'claimed') return { error: 'Job is not claimed.' }

  if (input.success) {
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

    await applyCredentialSuccess(admin, job)
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

async function applyCredentialSuccess(admin: Admin, job: { job_type: string; credential_id: string | null }) {
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
    job.job_type === 'assign_card'
  ) {
    await admin
      .from('access_credentials')
      .update({
        status: 'active',
        sync_status: 'synced',
        last_error: null,
        last_synced_at: now,
        updated_at: now,
      })
      .eq('id', job.credential_id)
  }
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
