'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, X } from 'lucide-react'
import { useProperty, type NewPropertyInput } from '@/lib/property-context'

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

const emptyForm: NewPropertyInput = {
  name: '',
  address: '',
  city: '',
  region: 'Greater Accra',
  totalRooms: 10,
}

interface AddPropertyDialogProps {
  open: boolean
  onClose: () => void
}

export function AddPropertyDialog({ open, onClose }: AddPropertyDialogProps) {
  const { addProperty } = useProperty()
  const [form, setForm] = useState<NewPropertyInput>(emptyForm)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) setForm(emptyForm)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !mounted) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim() || form.totalRooms < 1) return
    addProperty(form)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#22124C]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="modal-panel surface-card relative z-10 w-full max-w-lg overflow-hidden shadow-elevation-3">
        <div className="flex items-start justify-between gap-4 border-b border-[#E9ECEF] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="gradient-primary flex h-10 w-10 items-center justify-center rounded-xl shadow-elevation-2">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Add property</h2>
              <p className="modal-panel-subtle text-sm mt-0.5">
                Register a new hotel or rental in your portfolio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-panel-subtle rounded-lg p-2 transition-colors hover:bg-secondary/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="text-sm font-semibold">Property name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. MOJO Apartments Osu"
              className="input-soft mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Street address</label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Independence Avenue"
              className="input-soft mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">City</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Accra"
                className="input-soft mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="input-soft mt-2"
              >
                {GHANA_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">Total rooms</label>
            <input
              type="number"
              required
              min={1}
              max={999}
              value={form.totalRooms}
              onChange={(e) =>
                setForm({ ...form, totalRooms: Math.max(1, Number(e.target.value) || 1) })
              }
              className="input-soft mt-2"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="modal-panel-btn-secondary flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/80"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-elevation-2"
            >
              Add property
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
