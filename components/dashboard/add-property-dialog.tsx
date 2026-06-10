'use client'

import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { useProperty, type NewPropertyInput } from '@/lib/property-context'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'

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

  useEffect(() => {
    if (open) setForm(emptyForm)
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim() || form.totalRooms < 1) return
    addProperty(form)
    onClose()
  }

  return (
    <CenteredModal open={open} onClose={onClose} className="max-w-lg" aria-label="Add property">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="gradient-primary flex h-10 w-10 items-center justify-center rounded-xl shadow-elevation-2">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Add property</h2>
            <p className="modal-panel-subtle mt-0.5 text-sm">
              Register a new hotel or rental in your portfolio
            </p>
          </div>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
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
        </ModalBody>

        <ModalFooter>
          <div className="flex gap-3">
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
        </ModalFooter>
      </form>
    </CenteredModal>
  )
}
