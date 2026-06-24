'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { useProperty, type NewPropertyInput } from '@/lib/property-context'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { PropertyImageCropField } from '@/components/dashboard/property-image-crop-field'

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
  const router = useRouter()
  const { addProperty } = useProperty()
  const [form, setForm] = useState<NewPropertyInput>(emptyForm)
  const [profileImage, setProfileImage] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setForm(emptyForm)
      setProfileImage(null)
      setError(null)
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim() || form.totalRooms < 1) return

    setError(null)
    startTransition(async () => {
      const created = await addProperty({ ...form, profileImage })
      if (!created) {
        setError('Could not create property. Please try again.')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      className="flex max-h-[min(90dvh,calc(100dvh-2rem))] max-w-lg flex-col"
      aria-label="Add property"
    >
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
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
            <p className="mt-1 text-xs text-muted-foreground">
              Rooms 1–{form.totalRooms} will be created automatically as standard rooms.
            </p>
          </div>

          <PropertyImageCropField
            value={profileImage}
            onChange={setProfileImage}
            disabled={pending}
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-[#E9ECEF]">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="modal-panel-btn-secondary flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !form.name.trim() || !form.city.trim() || !form.address.trim()}
              className="flex-1 rounded-lg bg-[#3C216C] py-2.5 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:bg-[#4c2a85] hover:shadow-elevation-2 disabled:opacity-50"
            >
              {pending ? 'Adding…' : 'Add property'}
            </button>
          </div>
        </ModalFooter>
      </form>
    </CenteredModal>
  )
}
