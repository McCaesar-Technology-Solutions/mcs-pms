'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Copy, Check, Circle, CircleCheck } from 'lucide-react'
import { AccessFeedback } from '@/components/dashboard/access-feedback'
import {
  setAccessControlEnabled,
  startAccessSetup,
  upsertAccessPoint,
  deleteAccessPoint,
  setDeviceCredentialMode,
  upsertCloudAccessDevice,
  deleteCloudAccessDevice,
} from '@/app/actions/access-control'
import type {
  AccessDeviceRow,
  AccessIntegrationSummary,
  AccessPointRow,
  DeviceCredentialMode,
} from '@/lib/access/types'
import type { AccessAgentDownloadLinks } from '@/lib/access/agent-downloads'
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
  devices: AccessDeviceRow[]
  deviceKeys: string[]
  canManage: boolean
  agentDownloads?: AccessAgentDownloadLinks
  /** At least one staff access policy has doors mapped. */
  hasStaffPolicyDoors?: boolean
}

type DoorZone = 'unit' | 'lobby' | 'gate' | 'elevator' | 'gym' | 'other'

function zoneLabel(zone: string) {
  switch (zone) {
    case 'unit':
      return 'Unit (room)'
    case 'lobby':
      return 'Lobby / shared'
    case 'gym':
      return 'Gymnasium'
    case 'gate':
      return 'Gate'
    case 'elevator':
      return 'Elevator'
    default:
      return 'Other'
  }
}

export function AccessControlSettingsPanel({
  hotelId,
  propertyName,
  integration,
  points,
  rooms,
  devices,
  deviceKeys,
  canManage,
  agentDownloads,
  hasStaffPolicyDoors = false,
}: AccessControlSettingsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [envFile, setEnvFile] = useState<string | null>(null)
  const [copied, setCopied] = useState<'token' | 'env' | null>(null)
  /** When core setup is done, stay collapsed until Owner clicks Edit. */
  const [expanded, setExpanded] = useState(false)

  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [deviceKey, setDeviceKey] = useState(deviceKeys[0] ?? 'lobby')
  const [doorNo, setDoorNo] = useState('1')
  const [zone, setZone] = useState<DoorZone>('lobby')
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [grantsShared, setGrantsShared] = useState(true)
  const [pointActive, setPointActive] = useState(true)

  const [ctrlKey, setCtrlKey] = useState('lobby')
  const [ctrlLabel, setCtrlLabel] = useState('Lobby controller')
  const [ctrlHost, setCtrlHost] = useState('192.168.1.64')
  const [ctrlPort, setCtrlPort] = useState('80')
  const [ctrlUser, setCtrlUser] = useState('admin')
  const [ctrlPassword, setCtrlPassword] = useState('')
  const [ctrlRole, setCtrlRole] = useState<'door' | 'enrollment' | 'attendance'>('door')

  const enabled = integration.hotelFlagEnabled && integration.enabled
  const mode = integration.deviceCredentialMode ?? 'local'
  const cloudDevices = devices.filter((d) => d.managed_in_cloud)
  const doorDevices = cloudDevices.filter((d) => d.device_role === 'door')
  const enrollmentDevices = cloudDevices.filter((d) => d.device_role === 'enrollment')
  const attendanceDevices = cloudDevices.filter((d) => d.device_role === 'attendance')
  const doorReady = mode !== 'cloud' || doorDevices.some((d) => d.has_password)
  const enrollmentReady = mode !== 'cloud' || enrollmentDevices.some((d) => d.has_password)
  const hasGymMapped = points.some((p) => p.zone === 'gym' && p.is_active)

  const coreSteps = [
    { id: 'enable', label: 'Sync enabled', done: enabled },
    { id: 'token', label: 'Agent token created', done: integration.hasAgentToken },
    {
      id: 'controllers',
      label:
        mode === 'cloud'
          ? 'Door controller saved in MOJO'
          : 'Controller password set on apartment PC (.env)',
      done: doorReady,
    },
    { id: 'agent', label: 'Agent online on apartment PC', done: integration.agentOnline },
    { id: 'doors', label: 'At least one physical door mapped', done: points.length > 0 },
  ]
  const recommendedSteps = [
    {
      id: 'enrollment',
      label: 'Enrollment station (DS-K1F600U-D6E-F) saved',
      done: enrollmentReady,
    },
    { id: 'gym', label: 'Gymnasium mapped (zone: gym)', done: hasGymMapped },
    {
      id: 'staff-policy',
      label: 'Staff policy has policy door rights',
      done: hasStaffPolicyDoors,
    },
  ]
  const coreComplete = coreSteps.every((s) => s.done)
  const recommendedPending = recommendedSteps.filter((s) => !s.done)
  const setupComplete = coreComplete && recommendedPending.length === 0
  const showEditor = !coreComplete || expanded || Boolean(envFile || freshToken)

  async function runStartOrRotateSetup() {
    const result = await startAccessSetup(hotelId)
    if (!result.success || !result.data) {
      setError(result.success ? 'Setup failed.' : result.error)
      return
    }
    setFreshToken(result.data.token)
    setEnvFile(result.data.envFile)
    setExpanded(true)
    setMessage(
      coreComplete
        ? 'New agent config ready — update the apartment PC.'
        : 'Setup started. Copy the agent config below, then start the agent.',
    )
  }

  function resetDoorForm() {
    setEditingPointId(null)
    setLabel('')
    setDeviceKey(deviceKeys[0] ?? 'lobby')
    setDoorNo('1')
    setZone('lobby')
    setRoomId(rooms[0]?.id ?? '')
    setGrantsShared(true)
    setPointActive(true)
  }

  function startEditPoint(p: AccessPointRow) {
    setEditingPointId(p.id)
    setLabel(p.label)
    setDeviceKey(p.device_key)
    setDoorNo(String(p.door_no))
    setZone(p.zone as DoorZone)
    setRoomId(p.room_id ?? rooms[0]?.id ?? '')
    setGrantsShared(Boolean(p.grants_shared_access))
    setPointActive(p.is_active)
    setError(null)
    setMessage(null)
  }

  function sharedAccessForSubmit(z: DoorZone, shared: boolean) {
    if (z === 'unit' || z === 'gym') return false
    if (z === 'lobby' || z === 'gate' || z === 'elevator') return shared
    return shared
  }

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Property setup</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                One-time Hikvision setup for {propertyName}. Daily unlock and enroll live under
                Today / Guests / Staff.
              </p>
            </div>
          </div>
          {coreComplete && canManage ? (
            <button
              type="button"
              className="app-btn app-btn-secondary shrink-0"
              disabled={pending}
              onClick={() => setExpanded((v) => !v)}
            >
              {showEditor ? 'Hide setup details' : 'Edit setup'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="surface-card-body space-y-8">
        {!showEditor ? (
          <section className="space-y-3">
            <p className="flex items-start gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {setupComplete
                  ? 'Setup healthy — guest check-in/out and unlocks can run normally.'
                  : 'Core setup healthy — daily ops can run. Recommended items below still open.'}
              </span>
            </p>
            {recommendedPending.length > 0 ? (
              <ul className="space-y-1.5">
                {recommendedPending.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Circle className="h-4 w-4 shrink-0" />
                    {step.label}
                  </li>
                ))}
              </ul>
            ) : null}
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="app-btn app-btn-secondary"
                  disabled={pending}
                  onClick={() => setExpanded(true)}
                >
                  Edit setup
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-ghost"
                  disabled={pending}
                  onClick={() => run(runStartOrRotateSetup)}
                >
                  Rotate token
                </button>
              </div>
            ) : null}
            <AccessFeedback error={error} message={message} />
          </section>
        ) : null}

        {showEditor ? (
          <>
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

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Core ({coreSteps.filter((s) => s.done).length}/{coreSteps.length})
            </p>
            <ul className="mt-2 space-y-2">
              {coreSteps.map((step) => (
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
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended ({recommendedSteps.filter((s) => s.done).length}/
              {recommendedSteps.length})
            </p>
            <ul className="mt-2 space-y-2">
              {recommendedSteps.map((step) => (
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
          </div>

          {canManage ? (
            <div className="soft-panel space-y-3 p-4">
              <p className="text-sm font-semibold text-foreground">
                {coreComplete ? 'Agent token' : 'Start here'}
              </p>
              <p className="text-sm text-muted-foreground">
                {coreComplete
                  ? 'Rotate only when replacing the apartment PC. This creates a new config to paste into the agent.'
                  : 'Start setup enables sync and creates the agent config in one step. Then install the agent and map physical doors below.'}
                {integration.agentTokenPrefix
                  ? ` Current token prefix: ${integration.agentTokenPrefix}…`
                  : ''}
              </p>
              {!coreComplete && (agentDownloads?.macDmg || agentDownloads?.windowsSetup) ? (
                <p className="text-xs text-muted-foreground">
                  Downloads:{' '}
                  {agentDownloads.macDmg ? (
                    <a href={agentDownloads.macDmg} className="underline" download>
                      Mac
                    </a>
                  ) : null}
                  {agentDownloads.macDmg && agentDownloads.windowsSetup ? ' · ' : null}
                  {agentDownloads.windowsSetup ? (
                    <a href={agentDownloads.windowsSetup} className="underline" download>
                      Windows
                    </a>
                  ) : null}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="app-btn app-btn-primary"
                  onClick={() => run(runStartOrRotateSetup)}
                >
                  {coreComplete ? 'Rotate token' : 'Start setup'}
                </button>
                {coreComplete ? (
                  <label className="surface-inset flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2">
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
                      className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">Sync enabled</span>
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {canManage && (envFile || freshToken) && (
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Agent config (copy once)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Paste into the Access Agent on the apartment PC (or{' '}
                <code>services/hikvision-agent/.env</code>). Change only controller IP/password when
                needed.
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
          </section>
        )}

        {canManage && (
          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Controller passwords</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose where Hikvision admin passwords are stored. The agent still must run on the
                apartment network either way.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: 'cloud' as DeviceCredentialMode,
                    title: 'Store in MOJO (easier)',
                    hint: 'Enter IP/username/password here. Agent downloads them securely.',
                  },
                  {
                    value: 'local' as DeviceCredentialMode,
                    title: 'Apartment PC only (more private)',
                    hint: 'Passwords stay only in the agent .env on site.',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await setDeviceCredentialMode({
                        hotelId,
                        mode: opt.value,
                      })
                      if (!result.success) setError(result.error)
                      else setMessage(`Credential mode set to ${opt.value}.`)
                    })
                  }
                  className={`rounded-xl p-4 text-left transition-shadow ${
                    mode === opt.value
                      ? 'bg-primary/5 shadow-elevation-2 ring-2 ring-primary/25'
                      : 'bg-card shadow-elevation-1 hover:shadow-elevation-2'
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>

            {mode === 'cloud' && (
              <div className="soft-panel space-y-3 p-4">
                <p className="text-sm font-medium text-foreground">Devices in MOJO</p>
                <p className="text-xs text-muted-foreground">
                  Door controllers grant access. Enrollment station captures cards / face /
                  fingerprints. Attendance terminal (DS-K1A8503MF-B) is staff clock-in only — never
                  used as a door.
                  {attendanceDevices.length
                    ? ` Attendance devices saved: ${attendanceDevices.length}.`
                    : ''}
                </p>
                {cloudDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No devices saved yet.</p>
                ) : (
                  <ul className="soft-list">
                    {cloudDevices.map((d) => (
                      <li
                        key={d.id}
                        className="soft-list-item flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {d.label}{' '}
                            <span className="font-normal text-muted-foreground">({d.device_key})</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.device_role === 'enrollment'
                              ? 'Enrollment station'
                              : d.device_role === 'attendance'
                                ? 'Attendance terminal'
                                : 'Door controller'}
                            {d.model ? ` · ${d.model}` : ''} · {d.host}:{d.port ?? 80} · {d.username}
                            {d.has_password ? ' · password saved' : ' · missing password'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="app-btn app-btn-ghost text-destructive"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const result = await deleteCloudAccessDevice(hotelId, d.id)
                              if (!result.success) setError(result.error)
                              else setMessage('Device removed.')
                            })
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    run(async () => {
                      const result = await upsertCloudAccessDevice({
                        hotelId,
                        deviceKey: ctrlKey,
                        label: ctrlLabel,
                        host: ctrlHost,
                        port: Number(ctrlPort) || 80,
                        username: ctrlUser,
                        password: ctrlPassword || undefined,
                        useHttps: false,
                        deviceRole: ctrlRole,
                        model:
                          ctrlRole === 'enrollment'
                            ? 'DS-K1F600U-D6E-F'
                            : ctrlRole === 'attendance'
                              ? 'DS-K1A8503MF-B'
                              : undefined,
                      })
                      if (!result.success) {
                        setError(result.error)
                        return
                      }
                      setCtrlPassword('')
                      setMessage(
                        ctrlRole === 'enrollment'
                          ? 'Enrollment station (DS-K1F600U-D6E-F) saved.'
                          : ctrlRole === 'attendance'
                            ? 'Attendance terminal (DS-K1A8503MF-B) saved.'
                            : 'Door controller saved in MOJO.',
                      )
                    })
                  }}
                >
                  <FormField label="Role" htmlFor="ctrl-role">
                    <select
                      id="ctrl-role"
                      className={APP_FIELD_CLASS}
                      value={ctrlRole}
                      onChange={(e) => {
                        const role = e.target.value as 'door' | 'enrollment' | 'attendance'
                        setCtrlRole(role)
                        if (role === 'enrollment') {
                          setCtrlKey((k) => (k === 'lobby' ? 'enroll1' : k))
                          setCtrlLabel((l) =>
                            l === 'Lobby controller' ? 'DS-K1F600U-D6E-F enrollment' : l,
                          )
                        } else if (role === 'attendance') {
                          setCtrlKey((k) =>
                            k === 'lobby' || k === 'enroll1' ? 'attend1' : k,
                          )
                          setCtrlLabel('DS-K1A8503MF-B attendance')
                        }
                      }}
                    >
                      <option value="door">Door controller</option>
                      <option value="enrollment">Enrollment station (DS-K1F600U-D6E-F)</option>
                      <option value="attendance">Attendance terminal (DS-K1A8503MF-B)</option>
                    </select>
                  </FormField>
                  <FormField label="Device key" htmlFor="ctrl-key">
                    <input
                      id="ctrl-key"
                      className={APP_FIELD_CLASS}
                      value={ctrlKey}
                      onChange={(e) => setCtrlKey(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Label" htmlFor="ctrl-label">
                    <input
                      id="ctrl-label"
                      className={APP_FIELD_CLASS}
                      value={ctrlLabel}
                      onChange={(e) => setCtrlLabel(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="IP / host" htmlFor="ctrl-host">
                    <input
                      id="ctrl-host"
                      className={APP_FIELD_CLASS}
                      value={ctrlHost}
                      onChange={(e) => setCtrlHost(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Port" htmlFor="ctrl-port">
                    <input
                      id="ctrl-port"
                      className={APP_FIELD_CLASS}
                      value={ctrlPort}
                      onChange={(e) => setCtrlPort(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Username" htmlFor="ctrl-user">
                    <input
                      id="ctrl-user"
                      className={APP_FIELD_CLASS}
                      value={ctrlUser}
                      onChange={(e) => setCtrlUser(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Password" htmlFor="ctrl-pass">
                    <input
                      id="ctrl-pass"
                      type="password"
                      className={APP_FIELD_CLASS}
                      value={ctrlPassword}
                      onChange={(e) => setCtrlPassword(e.target.value)}
                      placeholder="Required for new devices"
                      autoComplete="new-password"
                    />
                  </FormField>
                  <div className="sm:col-span-2">
                    <button type="submit" className="app-btn app-btn-primary" disabled={pending}>
                      {ctrlRole === 'enrollment'
                        ? 'Save enrollment station'
                        : ctrlRole === 'attendance'
                          ? 'Save attendance terminal'
                          : 'Save door controller'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Physical doors</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Map Hikvision doors to rooms and zones. Staff who may open which doors is set under
              Staff → Policy door rights (not here). Unit = one room. Lobby/gate with
              &quot;shared&quot; = all in-house guests. Gymnasium zone = amenity for all guests.
            </p>
            {!hasGymMapped ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Tip: if Gymnasium was saved as Lobby/Other with shared access, edit it and set zone to{' '}
                <strong>Gymnasium</strong> so it is not treated as a corridor door.
              </p>
            ) : null}
          </div>

          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doors mapped yet.</p>
          ) : (
            <ul className="soft-list">
              {points.map((p) => (
                <li
                  key={p.id}
                  className="soft-list-item flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.device_key} · door {p.door_no} · {zoneLabel(p.zone)}
                      {p.room_number ? ` · Room ${p.room_number}` : ''}
                      {p.zone === 'gym'
                        ? ' · guest amenity'
                        : p.grants_shared_access
                          ? ' · shared with all guests'
                          : ' · not shared'}
                      {!p.is_active ? ' · inactive' : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="app-btn app-btn-secondary text-xs"
                        disabled={pending}
                        onClick={() => startEditPoint(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn-ghost text-destructive text-xs"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            const result = await deleteAccessPoint(hotelId, p.id)
                            if (!result.success) setError(result.error)
                            else {
                              if (editingPointId === p.id) resetDoorForm()
                              setMessage('Physical door removed.')
                            }
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
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
                    id: editingPointId ?? undefined,
                    deviceKey,
                    doorNo: Number(doorNo),
                    label,
                    zone,
                    roomId: zone === 'unit' ? roomId || null : null,
                    grantsSharedAccess: sharedAccessForSubmit(zone, grantsShared),
                    isActive: pointActive,
                  })
                  if (!result.success) {
                    setError(result.error)
                    return
                  }
                  resetDoorForm()
                  setMessage(
                    zone === 'gym'
                      ? 'Gymnasium mapped — all in-house guests get gym access.'
                      : editingPointId
                        ? 'Physical door updated.'
                        : 'Physical door saved.',
                  )
                })
              }}
            >
              <FormField label="Label" htmlFor="ac-label">
                <input
                  id="ac-label"
                  className={APP_FIELD_CLASS}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Lobby entrance / Gymnasium"
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
                  onChange={(e) => {
                    const next = e.target.value as DoorZone
                    setZone(next)
                    if (next === 'unit' || next === 'gym') setGrantsShared(false)
                    else if (next === 'lobby' || next === 'gate' || next === 'elevator') {
                      setGrantsShared(true)
                    }
                  }}
                >
                  <option value="lobby">Lobby / shared</option>
                  <option value="unit">Unit (room)</option>
                  <option value="gym">Gymnasium</option>
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
              {zone !== 'unit' && zone !== 'gym' ? (
                <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={grantsShared}
                    onChange={(e) => setGrantsShared(e.target.checked)}
                  />
                  Shared with all in-house guests
                </label>
              ) : null}
              {editingPointId ? (
                <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={pointActive}
                    onChange={(e) => setPointActive(e.target.checked)}
                  />
                  Active
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="app-btn app-btn-primary"
                  disabled={pending || !label.trim()}
                >
                  {editingPointId ? 'Save physical door' : 'Add physical door'}
                </button>
                {editingPointId ? (
                  <button
                    type="button"
                    className="app-btn app-btn-ghost"
                    disabled={pending}
                    onClick={() => resetDoorForm()}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </section>

        {coreComplete && canManage ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="app-btn app-btn-secondary"
              disabled={pending}
              onClick={() => {
                setExpanded(false)
                setFreshToken(null)
                setEnvFile(null)
              }}
            >
              Done editing
            </button>
          </div>
        ) : null}

        <AccessFeedback error={error} message={message} />
          </>
        ) : null}
      </div>
    </div>
  )
}
