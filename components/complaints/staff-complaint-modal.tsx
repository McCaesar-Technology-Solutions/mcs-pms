'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'
import {
  createStaffComplaint,
  getComplaintFormOptions,
  type ComplaintFormGuest,
  type ComplaintFormRoom,
} from '@/app/actions/complaints'
import type { ComplaintCategory, ComplaintPriority } from '@/types'

const softField =
  'mt-2 w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 text-sm text-foreground shadow-elevation-1 outline-none transition-[box-shadow,transform] focus:shadow-elevation-2 focus:ring-2 focus:ring-[#3C216C]/10'

const categories: ComplaintCategory[] = [
  'plumbing',
  'electrical',
  'hvac',
  'furniture',
  'cleaning',
  'noise',
  'other',
]

const priorities: ComplaintPriority[] = ['low', 'medium', 'high', 'urgent']

interface StaffComplaintModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function StaffComplaintModal({ open, onClose, onCreated }: StaffComplaintModalProps) {
  const [rooms, setRooms] = useState<ComplaintFormRoom[]>([])
  const [guests, setGuests] = useState<ComplaintFormGuest[]>([])
  const [roomId, setRoomId] = useState('')
  const [guestId, setGuestId] = useState('')
  const [category, setCategory] = useState<ComplaintCategory>('plumbing')
  const [priority, setPriority] = useState<ComplaintPriority>('medium')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    void getComplaintFormOptions().then((result) => {
      if (result.success && result.data) {
        setRooms(result.data.rooms)
        setGuests(result.data.guests)
      }
    })
  }, [open])

  function reset() {
    setRoomId('')
    setGuestId('')
    setCategory('plumbing')
    setPriority('medium')
    setDescription('')
  }

  function handleGuestChange(value: string) {
    setGuestId(value)
    const guest = guests.find((g) => g.id === value)
    if (guest?.roomId) setRoomId(guest.roomId)
  }

  async function handleSubmit() {
    if (description.trim().length < 10) {
      toast.error('Please describe the issue (at least 10 characters).')
      return
    }
    if (!roomId && !guestId) {
      toast.error('Select a room or a guest.')
      return
    }

    setSubmitting(true)
    const result = await createStaffComplaint({
      category,
      description: description.trim(),
      priority,
      roomId: roomId || undefined,
      guestId: guestId || undefined,
    })
    setSubmitting(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success('Complaint logged')
    reset()
    onCreated()
    onClose()
  }

  return (
    <CenteredModal open={open} onClose={onClose} aria-label="Log a complaint">
      <ModalHeader onClose={onClose}>
        <h2 className="font-display text-xl font-semibold text-[#3C216C]">Log a complaint</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Record an issue reported by a guest or found during operations.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Guest (optional)
          </label>
          <select
            value={guestId}
            onChange={(e) => handleGuestChange(e.target.value)}
            className={softField}
          >
            <option value="">No specific guest</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.roomNumber ? ` · Room ${g.roomNumber}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Room
          </label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={softField}>
            <option value="">Select a room…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              className={`${softField} capitalize`}
            >
              {categories.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
              className={`${softField} capitalize`}
            >
              {priorities.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue the guest is experiencing…"
            className={`${softField} min-h-28 resize-none`}
          />
        </div>
      </ModalBody>

      <ModalFooter className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-[#E9ECEF]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-elevation-2 transition-all hover:-translate-y-0.5 hover:shadow-elevation-3 disabled:opacity-60"
        >
          {submitting ? 'Logging…' : 'Log complaint'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}
