'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createStaffGroupChat, startStaffDm } from '@/app/actions/staff-conversation'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'

interface NewStaffConversationModalProps {
  hotelStaff: { id: string; name: string; role: string }[]
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export function NewStaffConversationModal({
  hotelStaff,
  onClose,
  onCreated,
}: NewStaffConversationModalProps) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm')
  const [selectedDmId, setSelectedDmId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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
    startTransition(async () => {
      if (mode === 'dm') {
        if (!selectedDmId) {
          setError('Pick a team member.')
          return
        }
        const result = await startStaffDm(selectedDmId)
        if (result.success && result.data) {
          toast.success('Conversation ready')
          onCreated(result.data.conversationId)
        } else if (!result.success) {
          setError(result.error ?? 'Could not start chat.')
        }
        return
      }

      if (!groupName.trim()) {
        setError('Group name is required.')
        return
      }
      if (memberIds.size === 0) {
        setError('Add at least one team member.')
        return
      }

      const result = await createStaffGroupChat({
        name: groupName.trim(),
        memberIds: [...memberIds],
      })
      if (result.success && result.data) {
        toast.success('Group created')
        onCreated(result.data.conversationId)
      } else if (!result.success) {
        setError(result.error ?? 'Could not create group.')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label="New team conversation">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">New conversation</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Message a colleague or start a group chat.</p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('dm')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'dm' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            Direct message
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'group' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            Group chat
          </button>
        </div>

        {mode === 'dm' ? (
          <div>
            <label htmlFor="dm-staff" className="mb-1.5 block text-sm font-medium text-foreground">
              Team member
            </label>
            <select
              id="dm-staff"
              value={selectedDmId}
              onChange={(e) => setSelectedDmId(e.target.value)}
              className="app-field w-full"
            >
              <option value="">Select staff…</option>
              {hotelStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="group-name" className="mb-1.5 block text-sm font-medium text-foreground">
                Group name
              </label>
              <input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Front desk shift"
                className="app-field w-full"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Members</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                {hotelStaff.map((s) => (
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
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={submit} className="app-btn app-btn-primary">
          {pending ? 'Creating…' : 'Start chat'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}
