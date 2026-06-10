'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Plus } from 'lucide-react'
import { useProperty } from '@/lib/property-context'
import { AddPropertyDialog } from '@/components/dashboard/add-property-dialog'

interface PropertySwitcherProps {
  collapsed?: boolean
}

export function PropertySwitcher({ collapsed = false }: PropertySwitcherProps) {
  const {
    properties,
    activeProperty,
    activePropertyId,
    setActivePropertyId,
    isAdmin,
    canSwitchProperty,
  } = useProperty()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Managers / technicians are locked to their assigned property: show a static,
  // non-interactive badge with no switcher dropdown and no "Add property".
  if (!canSwitchProperty) {
    return (
      <div
        title={collapsed ? activeProperty.name : undefined}
        className={`flex w-full items-center gap-3 rounded-xl bg-white/10 p-3 text-left shadow-elevation-1 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 shadow-elevation-2">
          <Building2 className="h-4 w-4 text-[var(--accent)]" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{activeProperty.name}</p>
            <p className="truncate text-xs font-medium text-[var(--sidebar-muted)]">
              {activeProperty.totalRooms} rooms · {activeProperty.city}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="listbox"
          title={collapsed ? activeProperty.name : undefined}
          className={`flex w-full items-center gap-3 rounded-xl bg-white/10 p-3 text-left shadow-elevation-1 transition-all hover:bg-white/14 ${
            collapsed ? 'justify-center' : ''
          } ${open ? 'ring-1 ring-white/20' : ''}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 shadow-elevation-2">
            <Building2 className="h-4 w-4 text-[var(--accent)]" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{activeProperty.name}</p>
                <p className="truncate text-xs font-medium text-[var(--sidebar-muted)]">
                  {activeProperty.totalRooms} rooms · {activeProperty.city}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--sidebar-muted)] transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </>
          )}
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Select property"
            className={`sidebar-property-menu absolute z-50 overflow-hidden rounded-xl border border-[rgba(212,166,46,0.22)] bg-[#2D215B] shadow-elevation-3 ${
              collapsed ? 'left-full top-0 ml-2 w-64' : 'left-0 right-0 top-[calc(100%+0.5rem)]'
            }`}
          >
            <div className="max-h-64 overflow-y-auto p-1.5">
              {properties.map((property) => {
                const isActive = property.id === activePropertyId
                return (
                  <button
                    key={property.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setActivePropertyId(property.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-[var(--sidebar-muted)] hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
                      {property.code.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{property.name}</p>
                      <p className="truncate text-xs opacity-80">
                        {property.city} · {property.totalRooms} rooms
                      </p>
                    </div>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-amber-300" />}
                  </button>
                )
              })}
            </div>

            {isAdmin && (
              <div className="border-t border-white/10 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setAddOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:bg-white/8 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add property
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AddPropertyDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
