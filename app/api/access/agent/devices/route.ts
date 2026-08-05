import { NextResponse } from 'next/server'
import { authenticateAccessAgent } from '@/lib/access/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptAccessSecret } from '@/lib/access/crypto'

/**
 * Returns controller connection details for the agent.
 * Passwords are decrypted only for authenticated agents in cloud mode.
 * Never used by the browser.
 */
export async function GET(request: Request) {
  const auth = await authenticateAccessAgent(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = createAdminClient()
  const { data: integration } = await admin
    .from('access_integrations')
    .select('device_credential_mode')
    .eq('hotel_id', auth.ctx.hotelId)
    .maybeSingle()

  const mode = integration?.device_credential_mode === 'cloud' ? 'cloud' : 'local'

  if (mode !== 'cloud') {
    return NextResponse.json({
      mode: 'local',
      devices: [],
      message: 'Credential mode is local — use DEVICES in agent .env.',
    })
  }

  const { data: devices } = await admin
    .from('access_devices')
    .select('id, device_key, label, host, port, username, use_https, managed_in_cloud, device_role, model')
    .eq('hotel_id', auth.ctx.hotelId)
    .eq('managed_in_cloud', true)

  const rows = devices ?? []
  if (!rows.length) {
    return NextResponse.json({ mode: 'cloud', devices: [] })
  }

  const { data: secrets } = await admin
    .from('access_device_secrets')
    .select('device_id, password_encrypted')
    .eq('hotel_id', auth.ctx.hotelId)
    .in(
      'device_id',
      rows.map((d) => d.id),
    )

  const secretByDevice = new Map((secrets ?? []).map((s) => [s.device_id, s.password_encrypted]))

  const out = []
  for (const d of rows) {
    if (!d.host || !d.username) continue
    const enc = secretByDevice.get(d.id)
    if (!enc) continue
    const password = await decryptAccessSecret(enc)
    if (!password) continue
    out.push({
      key: d.device_key,
      label: d.label,
      host: d.host,
      port: d.port ?? 80,
      username: d.username,
      password,
      useHttps: Boolean(d.use_https),
      role: d.device_role === 'enrollment' ? 'enrollment' : 'door',
      model: d.model ?? null,
    })
  }

  return NextResponse.json({ mode: 'cloud', devices: out })
}
