'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface EditableMessageContentProps {
  messageId: string
  body: string
  editedAt?: string | null
  canEdit?: boolean
  onSave: (messageId: string, body: string) => Promise<{ success: boolean; error?: string }>
  bodyClassName?: string
  editedClassName?: string
}

export function EditableMessageContent({
  messageId,
  body,
  editedAt,
  canEdit = false,
  onSave,
  bodyClassName = 'whitespace-pre-wrap break-words text-sm',
  editedClassName = 'text-[10px] opacity-60 italic',
}: EditableMessageContentProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(body)
  const [pending, startTransition] = useTransition()

  function startEdit() {
    setDraft(body)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(body)
    setEditing(false)
  }

  function saveEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === body) {
      setEditing(false)
      return
    }

    startTransition(async () => {
      const result = await onSave(messageId, trimmed)
      if (result.success) {
        setEditing(false)
        toast.success('Message updated')
      } else {
        toast.error(result.error ?? 'Could not update message.')
      }
    })
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          aria-label="Edit message"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveEdit}
            disabled={pending || !draft.trim()}
            className="rounded-lg bg-[#3C216C] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group/msg relative">
      <p className={bodyClassName}>{body}</p>
      {editedAt && <p className={editedClassName}>Edited</p>}
      {canEdit && (
        <button
          type="button"
          onClick={startEdit}
          className="absolute -right-1 -top-1 rounded-md bg-background/90 p-1 opacity-0 shadow-sm ring-1 ring-border transition-opacity group-hover/msg:opacity-100 focus:opacity-100"
          aria-label="Edit message"
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
