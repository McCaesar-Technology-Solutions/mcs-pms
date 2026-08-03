'use client'

import { useMemo, useState, useTransition } from 'react'
import { KeyRound, Copy, Check, Circle, CircleCheck } from 'lucide-react'
import {
  setAccessControlEnabled,
  rotateAccessAgentToken,
  startAccessSetup,
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
  const [envFile, setEnvFile] = useState<string | null>(null)
  const [copied, setCopied] = useState<'token' | 'env' | null>(null)

  const [label, setLabel] = useState('')
  const [deviceKey, setDeviceKey] = useState(deviceKeys[0] ?? 'lobby')
  const [doorNo, setDoorNo] = useState('1')
  const [zone, setZone] = useState<'unit' | 'lobby' | 'gate' | 'elevator' | 'other'>('lobby')
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')

  const enabled = integration.hotelFlagEnabled && integration.enabled
  const steps = useMemo(
    () => [
      { id: 'enable', label: 'Sync enabled', done: enabled },
      { id: 'token', label: 'Agent token created', done: integration.hasAgentToken },
      { id: 'agent', label: 'Agent online on apartment PC', done: integration.agentOnline },
      { id: 'doors', label: 'At least one door mapped', done: points.length > 0 },
    ],
    [enabled, integration.hasAgentToken, integration.agentOnline, points.length],
  )
  const setupComplete = steps.every((s) => s.done)

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

  async function copyText(value: string, kind: 'token' | 'env') {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
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
              One-time setup for {propertyName}. After this, check-in/out handles enrollment.
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

          <ul className="space-y-2">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-2 text-sm">
                {step.done ? (
                  <CircleCheck className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          {setupComplete ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Setup complete. Normal check-in/out will enroll and revoke guests automatically.
            </p>
          ) : canManage ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-foreground">Simplified setup (3 steps)</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Click Start setup — enables sync and creates your agent config.</li>
                <li>
                  On the apartment PC: copy the config into{' '}
                  <code className="text-xs">services/hikvision-agent/.env</code>, edit the controller
                  IP/password, then run <code className="text-xs">npm install && npm start</code>.
                </li>
                <li>Map doors below (device key must match the key in DEVICES, e.g. lobby).</li>
              </ol>
              <button
                type="button"
                disabled={pending}
                className="app-btn app-btn-primary"
                onClick={() =>
                  run(async () => {
                    const result = await startAccessSetup(hotelId)
                    if (!result.success || !result.data) {
                      setError(result.success ? 'Setup failed.' : result.error)
                      return
                    }
                    setFreshToken(result.data.token)
                    setEnvFile(result.data.envFile)
                    setMessage('Setup started. Copy the agent config below, then start the agent.')
                  })
                }
              >
                Start setup
              </button>
            </div>
          ) : null}
        </section>

        {canManage && (envFile || freshToken) && (
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Agent config (copy once)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Paste into <code>services/hikvision-agent/.env</code> on the apartment PC. Change only
                the controller IP and password.
              </p>
            </div>
            {envFile && (
              <div className="space-y-2">
                <pre className="surface-inset max-h-56 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
                  {envFile}
                </pre>
                <button
                  type="button"
                  className="app-btn app-btn-secondary"
                  onClick={() => copyText(envFile, 'env')}
                >
                  {copied === 'env' ? (
                    <>
                      <Check className="mr-1 inline h-4 w-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 inline h-4 w-4" /> Copy full .env
                    </>
                  )}
                </button>
              </div>
            )}
            {freshToken && !envFile && (
              <div className="surface-inset flex items-center gap-2 rounded-xl p-3">
                <code className="min-w-0 flex-1 break-all text-xs">{freshToken}</code>
                <button
                  type="button"
                  className="app-btn app-btn-ghost shrink-0"
                  onClick={() => copyText(freshToken, 'token')}
                >
                  {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Apartment PC shortcut after paste:{' '}
              <code>cd services/hikvision-agent && npm install && npm start</code>
              <br />
              Or interactive: <code>npm run setup</code>
            </p>
          </section>
        )}

        {canManage && setupComplete && (
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Advanced</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Disable sync or rotate the agent token if the apartment PC is replaced.
                {integration.agentTokenPrefix
                  ? ` Current token prefix: ${integration.agentTokenPrefix}…`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="surface-inset flex cursor-pointer items-start gap-3 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={pending}
                  onChange={(e) =>
                    run(async () => {
                      const result = await setAccessControlEnabled({
                        hotelId,
                        enabled: e.target.checked,
                      })
                      if (!result.success) setError(result.error)
                    })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Sync enabled</span>
              </label>
              <button
                type="button"
                disabled={pending}
                className="app-btn app-btn-secondary"
                onClick={() =>
                  run(async () => {
                    const result = await startAccessSetup(hotelId)
                    if (!result.success || !result.data) {
                      setError(result.success ? 'Could not rotate token.' : result.error)
                      return
                    }
                    setFreshToken(result.data.token)
                    setEnvFile(result.data.envFile)
                    setMessage('New agent config ready — update the apartment PC .env.')
                  })
                }
              >
                Rotate token / re-copy config
              </button>
            </div>
          </section>
        )}

        {!setupComplete && canManage && (
          <section className="space-y-3">
            <label className="surface-inset flex cursor-pointer items-start gap-3 rounded-xl p-4">
              <input
                type="checkbox"
                checked={enabled}
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
                  Enable Hikvision sync
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Prefer Start setup above — it enables this and creates the config together.
                </span>
              </span>
            </label>
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
                  setEnvFile(null)
                  setMessage('Token created. Prefer Start setup next time for a full .env.')
                })
              }
            >
              Rotate agent token only
            </button>
          </section>
        )}

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Door mappings</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tell MOJO which Hikvision door is which room. Device key must match the agent{' '}
              <code>DEVICES</code> key (example: lobby).
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
                  placeholder="Lobby entrance"
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
                  <option value="lobby">Lobby</option>
                  <option value="unit">Unit</option>
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
                <button
                  type="submit"
                  className="app-btn app-btn-primary"
                  disabled={pending || !label.trim()}
                >
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
