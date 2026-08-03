'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Copy, Check } from 'lucide-react'
import {
  setAccessControlEnabled,
  rotateAccessAgentToken,
  upsertAccessPoint,
  deleteAccessPoint,
} from '@/app/actions/access-control'
import type { AccessIntegrationSummary, AccessPointRow } from '@/lib/access/types'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'

interface RoomOption {
  id: string
  number: string
}

interface AccessControlSettingsPanelProps {
  hotelId: string
  propertyName: string
  integration: AccessIntegrationSummary
  points: AccessPointRow[]
  rooms: RoomOption[]
  deviceKeys: string[]
  canManage: boolean
}

export function AccessControlSettingsPanel({
  hotelId,
  propertyName,
  integration,
  points,
  rooms,
  deviceKeys,
  canManage,
}: AccessControlSettingsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [label, setLabel] = useState('')
  const [deviceKey, setDeviceKey] = useState(deviceKeys[0] ?? 'lobby')
  const [doorNo, setDoorNo] = useState('1')
  const [zone, setZone] = useState<'unit' | 'lobby' | 'gate' | 'elevator' | 'other'>('unit')
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')

  function run(action: () => Promise<void>) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-3">
          <KeyRound className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Hikvision access control</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Enroll and revoke guest door access from MOJO for {propertyName}.
            </p>
          </div>
        </div>
      </div>

      <div className="surface-card-body space-y-8">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                integration.agentOnline
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
              }`}
            >
              Agent {integration.agentOnline ? 'online' : 'offline'}
            </span>
            {integration.agentHostname && (
              <span className="text-xs text-muted-foreground">{integration.agentHostname}</span>
            )}
            {integration.agentLastSeenAt && (
              <span className="text-xs text-muted-foreground">
                Last seen {new Date(integration.agentLastSeenAt).toLocaleString()}
              </span>
            )}
          </div>

          {canManage && (
            <label className="surface-inset flex cursor-pointer items-start gap-3 rounded-xl p-4 transition-colors hover:bg-muted/40">
              <input
                type="checkbox"
                checked={integration.hotelFlagEnabled && integration.enabled}
                disabled={pending}
                onChange={(e) =>
                  run(async () => {
                    const result = await setAccessControlEnabled({
                      hotelId,
                      enabled: e.target.checked,
                    })
                    if (!result.success) {
                      setError(result.error)
                      return
                    }
                    setMessage(e.target.checked ? 'Access control enabled.' : 'Access control disabled.')
                  })
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Enable Hikvision sync on check-in / checkout
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Requires the on-site agent running on the apartment LAN. Device passwords stay on the
                  agent only.
                </span>
              </span>
            </label>
          )}
        </section>

        {canManage && (
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Agent token</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Shown once on rotate. Put it in the agent `.env` as `AGENT_TOKEN`.
                {integration.agentTokenPrefix
                  ? ` Current prefix: ${integration.agentTokenPrefix}…`
                  : ' No token issued yet.'}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              className="app-btn app-btn-secondary"
              onClick={() =>
                run(async () => {
                  const result = await rotateAccessAgentToken(hotelId)
                  if (!result.success || !result.data) {
                    setError(result.success ? 'No token returned.' : result.error)
                    return
                  }
                  setFreshToken(result.data.token)
                  setMessage('New agent token created. Copy it now — it will not be shown again.')
                })
              }
            >
              Rotate agent token
            </button>
            {freshToken && (
              <div className="surface-inset flex items-center gap-2 rounded-xl p-3">
                <code className="min-w-0 flex-1 break-all text-xs">{freshToken}</code>
                <button
                  type="button"
                  className="app-btn app-btn-ghost shrink-0"
                  onClick={async () => {
                    await navigator.clipboard.writeText(freshToken)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Door mappings</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Map each Hikvision door to a room or shared area. Device key must match the agent
              `DEVICES` key.
            </p>
          </div>

          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doors mapped yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {points.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.device_key} · door {p.door_no} · {p.zone}
                      {p.room_number ? ` · Room ${p.room_number}` : ''}
                      {!p.is_active ? ' · inactive' : ''}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="app-btn app-btn-ghost text-destructive"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await deleteAccessPoint(hotelId, p.id)
                          if (!result.success) setError(result.error)
                          else setMessage('Door mapping removed.')
                        })
                      }
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  const result = await upsertAccessPoint({
                    hotelId,
                    deviceKey,
                    doorNo: Number(doorNo),
                    label,
                    zone,
                    roomId: zone === 'unit' ? roomId || null : null,
                    grantsSharedAccess: zone !== 'unit',
                  })
                  if (!result.success) {
                    setError(result.error)
                    return
                  }
                  setLabel('')
                  setMessage('Door mapping saved.')
                })
              }}
            >
              <FormField label="Label" htmlFor="ac-label">
                <input
                  id="ac-label"
                  className={APP_FIELD_CLASS}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Room B204"
                  required
                />
              </FormField>
              <FormField label="Device key" htmlFor="ac-device">
                <input
                  id="ac-device"
                  className={APP_FIELD_CLASS}
                  value={deviceKey}
                  onChange={(e) => setDeviceKey(e.target.value)}
                  list="ac-device-keys"
                  required
                />
                <datalist id="ac-device-keys">
                  {deviceKeys.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </FormField>
              <FormField label="Door number" htmlFor="ac-door">
                <input
                  id="ac-door"
                  className={APP_FIELD_CLASS}
                  type="number"
                  min={1}
                  max={64}
                  value={doorNo}
                  onChange={(e) => setDoorNo(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Zone" htmlFor="ac-zone">
                <select
                  id="ac-zone"
                  className={APP_FIELD_CLASS}
                  value={zone}
                  onChange={(e) => setZone(e.target.value as typeof zone)}
                >
                  <option value="unit">Unit</option>
                  <option value="lobby">Lobby</option>
                  <option value="gate">Gate</option>
                  <option value="elevator">Elevator</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              {zone === 'unit' && (
                <FormField label="Room" htmlFor="ac-room">
                  <select
                    id="ac-room"
                    className={APP_FIELD_CLASS}
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    required
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
              <div className="sm:col-span-2">
                <button type="submit" className="app-btn app-btn-primary" disabled={pending || !label.trim()}>
                  Add door mapping
                </button>
              </div>
            </form>
          )}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
      </div>
    </div>
  )
}
