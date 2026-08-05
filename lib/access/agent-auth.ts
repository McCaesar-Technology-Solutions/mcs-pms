import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAgentToken } from '@/lib/access/crypto'
import { assertRateLimit } from '@/lib/rate-limit'

const AGENT_ONLINE_MS = 2 * 60 * 1000

export interface AgentAuthContext {
  hotelId: string
  integrationId: string
  agentId: string
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  return token || null
}

export async function authenticateAccessAgent(
  request: Request,
): Promise<{ ok: true; ctx: AgentAuthContext } | { ok: false; status: number; error: string }> {
  const token = extractBearerToken(request)
  if (!token) {
    return { ok: false, status: 401, error: 'Missing bearer token.' }
  }

  const hotelIdHeader = request.headers.get('x-mojo-hotel-id')?.trim()
  if (!hotelIdHeader) {
    return { ok: false, status: 400, error: 'Missing X-Mojo-Hotel-Id header.' }
  }

  // One agent: ~40/min poll (1.5s) + heartbeat + device refresh + retries.
  // Generous headroom so brief double-launch / reconnect storms do not brick unlocks.
  const limited = await assertRateLimit(
    `access-agent:${hotelIdHeader}:${token.slice(0, 12)}`,
    { max: 600, windowMs: 60_000, cooldownMs: 50 },
    'Agent rate limit exceeded.',
  )
  if (limited) {
    return { ok: false, status: 429, error: limited }
  }

  const admin = createAdminClient()
  const { data: integration } = await admin
    .from('access_integrations')
    .select('id, hotel_id, enabled, agent_token_hash')
    .eq('hotel_id', hotelIdHeader)
    .maybeSingle()

  if (!integration?.enabled || !integration.agent_token_hash) {
    return { ok: false, status: 401, error: 'Access agent not configured.' }
  }

  if (!verifyAgentToken(token, integration.agent_token_hash)) {
    return { ok: false, status: 401, error: 'Invalid agent token.' }
  }

  const { data: hotel } = await admin
    .from('hotels')
    .select('access_control_enabled')
    .eq('id', hotelIdHeader)
    .maybeSingle()

  if (!hotel?.access_control_enabled) {
    return { ok: false, status: 403, error: 'Access control disabled for this property.' }
  }

  const agentId =
    request.headers.get('x-mojo-agent-id')?.trim() ||
    request.headers.get('x-mojo-agent-hostname')?.trim() ||
    'agent'

  return {
    ok: true,
    ctx: {
      hotelId: integration.hotel_id,
      integrationId: integration.id,
      agentId,
    },
  }
}

export async function touchAgentHeartbeat(input: {
  hotelId: string
  version?: string | null
  hostname?: string | null
  devices?: Array<{
    deviceKey: string
    label?: string
    model?: string | null
    serialNumber?: string | null
    firmware?: string | null
    online?: boolean
  }>
}): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin
    .from('access_integrations')
    .update({
      agent_last_seen_at: now,
      agent_version: input.version ?? null,
      agent_hostname: input.hostname ?? null,
      updated_at: now,
    })
    .eq('hotel_id', input.hotelId)

  if (!input.devices?.length) return

  for (const d of input.devices) {
    await admin.from('access_devices').upsert(
      {
        hotel_id: input.hotelId,
        device_key: d.deviceKey,
        label: d.label?.trim() || d.deviceKey,
        model: d.model ?? null,
        serial_number: d.serialNumber ?? null,
        firmware: d.firmware ?? null,
        is_online: d.online ?? true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'hotel_id,device_key' },
    )
  }
}

export function isAgentOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < AGENT_ONLINE_MS
}
