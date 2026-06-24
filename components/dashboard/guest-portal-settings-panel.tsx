'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Plus, Trash2, Pencil } from 'lucide-react'
import {
  fetchGuestPortalSettings,
  updateGuestPortalSettings,
  addLocalGuideItem,
  updateLocalGuideItem,
  removeLocalGuideItem,
} from '@/app/actions/guest-portal-staff'
import type { LocalGuideRow } from '@/lib/data/local-guide'

interface GuestPortalSettingsPanelProps {
  hotelId: string
  propertyName: string
  canEdit?: boolean
}

export function GuestPortalSettingsPanel({
  hotelId,
  propertyName,
  canEdit = true,
}: GuestPortalSettingsPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [parking, setParking] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [checkOutTime, setCheckOutTime] = useState('11:00 AM')
  const [welcome, setWelcome] = useState('')
  const [localGuide, setLocalGuide] = useState<LocalGuideRow[]>([])

  const [newGuideTitle, setNewGuideTitle] = useState('')
  const [newGuideBody, setNewGuideBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchGuestPortalSettings(hotelId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.success || !result.data) {
        setError(!result.success ? result.error : 'Could not load settings.')
        return
      }
      const d = result.data
      setWifiSsid(d.wifiSsid ?? '')
      setWifiPassword(d.wifiPassword ?? '')
      setParking(d.parking ?? '')
      setEmergencyPhone(d.emergencyPhone ?? '')
      setCheckOutTime(d.checkOutTime)
      setWelcome(d.welcome ?? '')
      setLocalGuide(d.localGuide)
    })
    return () => {
      cancelled = true
    }
  }, [hotelId])

  function refresh() {
    router.refresh()
    fetchGuestPortalSettings(hotelId).then((result) => {
      if (result.success && result.data) setLocalGuide(result.data.localGuide)
    })
  }

  function handleSaveProperty(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setError(null)
    startTransition(async () => {
      const result = await updateGuestPortalSettings(hotelId, {
        wifiSsid,
        wifiPassword,
        parking,
        emergencyPhone,
        checkOutTime,
        welcome,
      })
      if (!result.success) setError(result.error)
      else refresh()
    })
  }

  function handleAddGuide(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setError(null)
    startTransition(async () => {
      const result = await addLocalGuideItem(hotelId, {
        title: newGuideTitle,
        body: newGuideBody,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setNewGuideTitle('')
      setNewGuideBody('')
      refresh()
    })
  }

  function handleSaveGuide(itemId: string) {
    if (!canEdit) return
    setError(null)
    startTransition(async () => {
      const result = await updateLocalGuideItem(hotelId, itemId, {
        title: editTitle,
        body: editBody,
      })
      if (!result.success) setError(result.error)
      else {
        setEditingId(null)
        refresh()
      }
    })
  }

  function handleRemoveGuide(itemId: string) {
    if (!canEdit) return
    setError(null)
    startTransition(async () => {
      const result = await removeLocalGuideItem(hotelId, itemId)
      if (!result.success) setError(result.error)
      else refresh()
    })
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Guest portal experience</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Wi-Fi, welcome message, and local guide shown to guests at {propertyName}. Changes
              are logged in the activity log.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 border-t border-border/60 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <form onSubmit={handleSaveProperty} className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Property info</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Wi-Fi name</label>
                  <input
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    disabled={!canEdit || pending}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Wi-Fi password</label>
                  <input
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    disabled={!canEdit || pending}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Check-out time</label>
                  <input
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    disabled={!canEdit || pending}
                    placeholder="11:00 AM"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Emergency phone</label>
                  <input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    disabled={!canEdit || pending}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Parking notes</label>
                <textarea
                  value={parking}
                  onChange={(e) => setParking(e.target.value)}
                  disabled={!canEdit || pending}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Welcome message</label>
                <textarea
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  disabled={!canEdit || pending}
                  rows={3}
                  placeholder="Welcome to our property! We're glad you're here."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              {canEdit && (
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save property info'}
                </button>
              )}
            </form>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Local guide</p>
              <ul className="space-y-2">
                {localGuide.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border/60 bg-[#FAFDFF] px-4 py-3"
                  >
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                        />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveGuide(item.id)}
                            disabled={pending}
                            className="rounded-lg bg-[#3C216C] px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#3C216C]">{item.title}</p>
                          <p className="mt-1 text-sm text-foreground">{item.body}</p>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id)
                                setEditTitle(item.title)
                                setEditBody(item.body)
                              }}
                              className="rounded-lg p-2 text-[#3C216C] hover:bg-[#3C216C]/5"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveGuide(item.id)}
                              disabled={pending}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {canEdit && (
                <form onSubmit={handleAddGuide} className="space-y-3 rounded-xl border border-dashed border-border p-4">
                  <input
                    value={newGuideTitle}
                    onChange={(e) => setNewGuideTitle(e.target.value)}
                    placeholder="Section title"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    value={newGuideBody}
                    onChange={(e) => setNewGuideBody(e.target.value)}
                    rows={3}
                    placeholder="Helpful info for guests…"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={pending || newGuideTitle.trim().length < 2}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#3C216C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add guide section
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
