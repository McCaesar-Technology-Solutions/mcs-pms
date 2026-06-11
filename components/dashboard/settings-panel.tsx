'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, Plus, Check, FileText } from 'lucide-react'
import { updateHotelSettings } from '@/app/actions/settings'
import { useProperty } from '@/lib/property-context'
import { AddPropertyDialog } from '@/components/dashboard/add-property-dialog'
import type { HotelSettings } from '@/lib/data/settings'

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Volta',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Savannah',
  'North East',
  'Oti',
  'Western North',
] as const

interface SettingsPanelProps {
  hotelSettings?: HotelSettings | null
  staffHref?: string
}

export function SettingsPanel({ hotelSettings, staffHref = '/owner/staff' }: SettingsPanelProps) {
  const router = useRouter()
  const {
    properties,
    activePropertyId,
    switchProperty,
    isAdmin,
    reloadProperties,
  } = useProperty()
  const [addOpen, setAddOpen] = useState(false)
  const [switchPending, startSwitch] = useTransition()
  const [savePending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('Greater Accra')
  const [gtaLicense, setGtaLicense] = useState('')
  const [gtaExpiry, setGtaExpiry] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [invoicePrefix, setInvoicePrefix] = useState('MOJO')

  useEffect(() => {
    if (!hotelSettings) return
    setName(hotelSettings.name)
    setAddress(hotelSettings.address ?? '')
    setCity(hotelSettings.city ?? '')
    setRegion(hotelSettings.region ?? 'Greater Accra')
    setGtaLicense(hotelSettings.gta_license_number ?? '')
    setGtaExpiry(hotelSettings.gta_license_expiry ?? '')
    setVatNumber(hotelSettings.vat_registration_number ?? '')
    setInvoicePrefix(hotelSettings.invoice_prefix ?? 'MOJO')
    setError(null)
    setSaved(false)
  }, [hotelSettings])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!hotelSettings) return

    setError(null)
    setSaved(false)
    startSave(async () => {
      const result = await updateHotelSettings({
        hotelId: hotelSettings.id,
        name,
        address,
        city,
        region,
        gta_license_number: gtaLicense,
        gta_license_expiry: gtaExpiry,
        vat_registration_number: vatNumber,
        invoice_prefix: invoicePrefix,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setSaved(true)
      await reloadProperties()
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <>
      {/* Portfolio */}
      <div className="surface-card mb-6 p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Your properties</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Switch between apartments in your portfolio
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevation-2"
            >
              <Plus className="h-4 w-4" />
              Add property
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {properties.map((property) => {
            const isActive = property.id === activePropertyId
            return (
              <div
                key={property.id}
                className={`surface-inset rounded-xl p-4 transition-shadow ${
                  isActive ? 'shadow-elevation-1 ring-2 ring-primary/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{property.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {property.code} · {property.city}, {property.region}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{property.address}</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {property.totalRooms} rooms
                    </p>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>
                {!isActive && isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      startSwitch(async () => {
                        const ok = await switchProperty(property.id)
                        if (ok) router.refresh()
                      })
                    }}
                    disabled={switchPending}
                    className="mt-4 w-full rounded-lg bg-secondary py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                  >
                    Switch to this property
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {hotelSettings ? (
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Property details */}
          <div className="surface-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Property details</h3>
                <p className="text-sm text-muted-foreground">Active apartment settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground">Property name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-soft mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Street address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-soft mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input-soft mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Region</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="input-soft mt-2"
                  >
                    {GHANA_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="surface-inset rounded-xl p-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{hotelSettings.roomCount}</span>{' '}
                rooms in this property.{' '}
                <Link href="/owner/rooms" className="font-semibold text-primary hover:underline">
                  Manage rooms
                </Link>
              </div>
            </div>
          </div>

          {/* GRA / tax compliance */}
          <div className="surface-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">GRA & tax compliance</h3>
                <p className="text-sm text-muted-foreground">Used on invoices and GRA reports</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground">GTA license number</label>
                <input
                  type="text"
                  value={gtaLicense}
                  onChange={(e) => setGtaLicense(e.target.value)}
                  placeholder="e.g. GTA/HOT/2024/001"
                  className="input-soft mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">GTA license expiry</label>
                <input
                  type="date"
                  value={gtaExpiry}
                  onChange={(e) => setGtaExpiry(e.target.value)}
                  className="input-soft mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">VAT registration (TIN)</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="e.g. C0001234567"
                  className="input-soft mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Invoice prefix</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. MOJO"
                  maxLength={12}
                  className="input-soft mt-2 uppercase"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used for sequential numbers like {invoicePrefix || 'MOJO'}-{new Date().getFullYear()}-00001 (resets each year)
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {saved && (
              <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Settings saved successfully.
              </p>
            )}
            <button
              type="submit"
              disabled={savePending}
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {savePending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="surface-card p-6 text-sm text-muted-foreground">
          Property settings are available when signed in as an owner with an active apartment.
        </div>
      )}

      {/* Staff shortcut */}
      {hotelSettings && (
        <div className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Team & staff</h3>
                <p className="text-sm text-muted-foreground">
                  Invite managers and technicians for this property
                </p>
              </div>
            </div>
            <Link
              href={staffHref}
              className="inline-flex items-center justify-center rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              Manage staff
            </Link>
          </div>
        </div>
      )}

      <AddPropertyDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
