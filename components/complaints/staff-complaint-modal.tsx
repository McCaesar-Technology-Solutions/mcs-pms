'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'
import { APP_FIELD_CLASS, FormField } from '@/components/ui/form-field'
import {
  createStaffComplaint,
  getComplaintFormOptions,
  type ComplaintFormGuest,
  type ComplaintFormRoom,
} from '@/app/actions/complaints'
import type { ComplaintCategory, ComplaintPriority } from '@/types'

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
        <FormField label="Guest (optional)">
          <select
            value={guestId}
            onChange={(e) => handleGuestChange(e.target.value)}
            className={APP_FIELD_CLASS}
          >
            <option value="">No specific guest</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.roomNumber ? ` · Room ${g.roomNumber}` : ''}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Room">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={APP_FIELD_CLASS}>
            <option value="">Select a room…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              className={`${APP_FIELD_CLASS} capitalize`}
            >
              {categories.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
              className={`${APP_FIELD_CLASS} capitalize`}
            >
              {priorities.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue the guest is experiencing…"
            className={`${APP_FIELD_CLASS} min-h-28 resize-none`}
          />
        </FormField>
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
