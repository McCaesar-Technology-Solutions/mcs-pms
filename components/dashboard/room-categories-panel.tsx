'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createRoomCategory,
  deleteRoomCategory,
  updateRoomCategory,
} from '@/app/actions/room-categories'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type { RoomCategory } from '@/types'

interface RoomCategoriesPanelProps {
  categories: RoomCategory[]
}

export function RoomCategoriesPanel({ categories }: RoomCategoriesPanelProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<RoomCategory | null>(null)

  return (
    <div className="surface-card p-6">
      <div className="surface-card-accent" />
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Room categories</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Define categories and default nightly or monthly rates for your rooms.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2"
        >
          <Plus className="h-4 w-4" />
          Add category
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No categories yet. Add one before creating rooms.
        </p>
      ) : (
        <div className="relative divide-y divide-border/60 rounded-xl bg-white shadow-elevation-1">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-foreground">{category.name}</p>
                <p className="text-sm text-muted-foreground">
                  Nightly: ₵{category.default_nightly_rate.toLocaleString()}
                  {category.default_monthly_rate != null
                    ? ` · Monthly: ₵${category.default_monthly_rate.toLocaleString()}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(category)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CategoryModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      )}

      {editing && (
        <CategoryModal
          category={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

interface CategoryModalProps {
  category?: RoomCategory
  onClose: () => void
  onDone: () => void
}

function CategoryModal({ category, onClose, onDone }: CategoryModalProps) {
  const isEdit = Boolean(category)
  const [name, setName] = useState(category?.name ?? '')
  const [rate, setRate] = useState(String(category?.default_nightly_rate ?? ''))
  const [monthlyRate, setMonthlyRate] = useState(
    category?.default_monthly_rate != null ? String(category.default_monthly_rate) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const defaultNightlyRate = Number(rate)
      const defaultMonthlyRate: number | '' =
        monthlyRate.trim() === '' ? '' : Number(monthlyRate)
      const result = isEdit
        ? await updateRoomCategory(category!.id, { name, defaultNightlyRate, defaultMonthlyRate })
        : await createRoomCategory({ name, defaultNightlyRate, defaultMonthlyRate })
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteRoomCategory(category!.id)
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label={isEdit ? 'Edit category' : 'Add category'}>
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">
          {isEdit ? 'Edit category' : 'Add category'}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isEdit
            ? 'Update the name or default rates.'
            : 'New rooms can pick this category when created.'}
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <Field label="Category name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Executive Suite"
            className={fieldClass}
          />
        </Field>

        <Field label="Default nightly rate (₵)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="250"
            className={fieldClass}
          />
        </Field>

        <Field label="Default monthly rate (₵, optional)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
            placeholder="6000"
            className={fieldClass}
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between gap-3">
        {isEdit ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </ModalFooter>
    </CenteredModal>
  )
}

const fieldClass =
  'w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 text-sm text-foreground shadow-elevation-1 outline-none transition-[box-shadow] focus:shadow-elevation-2 focus:ring-2 focus:ring-[#3C216C]/10'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
