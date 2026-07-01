'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addStaffToGroupChat } from '@/app/actions/staff-conversation'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'

interface AddGroupMembersModalProps {
  conversationId: string
  conversationName: string
  existingMemberIds: string[]
  hotelStaff: { id: string; name: string; role: string }[]
  onClose: () => void
  onAdded: () => void
}

export function AddGroupMembersModal({
  conversationId,
  conversationName,
  existingMemberIds,
  hotelStaff,
  onClose,
  onAdded,
}: AddGroupMembersModalProps) {
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds])
  const availableStaff = useMemo(
    () => hotelStaff.filter((s) => !existingSet.has(s.id)),
    [hotelStaff, existingSet],
  )

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    setError(null)
    if (memberIds.size === 0) {
      setError('Select at least one team member.')
      return
    }

    startTransition(async () => {
      const result = await addStaffToGroupChat({
        conversationId,
        memberIds: [...memberIds],
      })

      if (result.success && result.data) {
        const count = result.data.addedCount
        toast.success(count === 1 ? 'Member added' : `${count} members added`)
        onAdded()
        onClose()
        return
      }

      if (!result.success) {
        setError(result.error ?? 'Could not add members.')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label="Add group members">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Add members</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Add staff to <span className="font-medium text-foreground">{conversationName}</span>.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {availableStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everyone on your team is already in this group.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Team members</p>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-secondary/25 p-2 shadow-[inset_0_1px_2px_rgba(var(--shadow-tint),0.04)]">
              {availableStaff.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={memberIds.has(s.id)}
                      onChange={() => toggleMember(s.id)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="ml-auto text-xs capitalize text-muted-foreground">{s.role}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || availableStaff.length === 0}
          onClick={submit}
          className="app-btn app-btn-primary"
        >
          {pending ? 'Adding…' : 'Add to group'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}
