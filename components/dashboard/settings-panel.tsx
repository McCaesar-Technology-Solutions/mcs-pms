'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, Bell, Lock, Zap, Copy, CheckCircle, Plus, Check } from 'lucide-react'
import { useProperty } from '@/lib/property-context'
import { AddPropertyDialog } from '@/components/dashboard/add-property-dialog'

export function SettingsPanel() {
  const router = useRouter()
  const { properties, activeProperty, activePropertyId, switchProperty, isAdmin } = useProperty()
  const [addOpen, setAddOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <div className="surface-card p-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Your properties</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage hotels and rentals in your portfolio
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((property) => {
            const isActive = property.id === activePropertyId
            return (
              <div
                key={property.id}
                className={`surface-inset rounded-xl p-4 transition-shadow ${
                  isActive ? 'ring-2 ring-primary/30 shadow-elevation-1' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{property.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {property.code} · {property.city}, {property.region}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{property.address}</p>
                    <p className="text-sm font-medium text-foreground mt-2">
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
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => {
                      if (property.id === activePropertyId) return
                      startTransition(async () => {
                        const ok = await switchProperty(property.id)
                        if (ok) router.refresh()
                      })
                    }}
                    disabled={pending}
                    className="mt-4 w-full rounded-lg bg-secondary py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
                  >
                    Switch to this property
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-6 w-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Property Information</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground">Property Name</label>
              <input
                type="text"
                defaultValue={activeProperty.name}
                key={activeProperty.id}
                className="input-soft mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground">Address</label>
              <input
                type="text"
                defaultValue={`${activeProperty.address}, ${activeProperty.city}, ${activeProperty.region}`}
                key={`${activeProperty.id}-address`}
                className="input-soft mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground">Property code</label>
                <input
                  type="text"
                  defaultValue={activeProperty.code}
                  key={`${activeProperty.id}-code`}
                  className="input-soft mt-2"
                  readOnly
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Total rooms</label>
                <input
                  type="number"
                  defaultValue={activeProperty.totalRooms}
                  key={`${activeProperty.id}-rooms`}
                  className="input-soft mt-2"
                />
              </div>
            </div>

            <button className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:shadow-elevation-2 transition-all hover:-translate-y-0.5">
              Save Changes
            </button>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-6 w-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
          </div>

          <div className="space-y-3 mb-4">
            <div className="surface-inset p-3 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Kofi Mensah</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="surface-inset p-3 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Ama Osei</p>
                <p className="text-xs text-muted-foreground">Manager</p>
              </div>
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
          </div>

          <button className="w-full py-2.5 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-all">
            Add Team Member
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="surface-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="h-6 w-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">New booking notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">Guest check-in reminders</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">Payment received alerts</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">Maintenance task assignments</span>
            </label>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="h-6 w-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Security</h3>
          </div>

          <div className="space-y-4">
            <div className="surface-inset p-3 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Two-Factor Authentication</p>
                <p className="text-xs text-amber-600">Enabled</p>
              </div>
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>

            <button className="w-full py-2.5 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-all text-sm">
              Change Password
            </button>
          </div>
        </div>
      </div>

      <div className="surface-card p-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">API & Integrations</h3>
        </div>

        <div className="space-y-4">
          <div className="info-block info-block-blue p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-foreground">API Key</p>
                <p className="text-xs text-muted-foreground mt-1">Use for custom integrations</p>
              </div>
              <Copy className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground" />
            </div>
            <code className="text-xs surface-inset px-3 py-2 rounded-lg text-muted-foreground block overflow-x-auto">sk_live_4eC39HqLyjWDarhtT657j8</code>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-3 surface-inset p-3 rounded-xl cursor-pointer hover:shadow-elevation-1 transition-shadow">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">Zapier</span>
            </label>
            <label className="flex items-center gap-3 surface-inset p-3 rounded-xl cursor-pointer hover:shadow-elevation-1 transition-shadow">
              <input type="checkbox" className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">Google Sheets</span>
            </label>
            <label className="flex items-center gap-3 surface-inset p-3 rounded-xl cursor-pointer hover:shadow-elevation-1 transition-shadow">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              <span className="text-sm font-medium text-foreground">Slack</span>
            </label>
          </div>
        </div>
      </div>

      <AddPropertyDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
