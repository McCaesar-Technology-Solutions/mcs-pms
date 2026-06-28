'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createExpense, deleteExpense } from '@/app/actions/expenses'
import { expenseSummary, type ExpenseRow } from '@/lib/data/expenses'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'

interface ExpensesManagerProps {
  expenses: ExpenseRow[]
}

export function ExpensesManager({ expenses }: ExpensesManagerProps) {
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()
  const summary = expenseSummary(expenses)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total logged</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">₵{summary.total.toFixed(2)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paid</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">₵{summary.paid.toFixed(2)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">₵{summary.pending.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add expense
        </button>
      </div>

      <div className="surface-card overflow-hidden">
        {expenses.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No expenses recorded yet. Log vendor payments and operating costs here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="hk-table w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{e.expenseDate}</td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor ?? '-'}</td>
                    <td className="px-4 py-3 font-medium">₵{e.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 capitalize">{e.paymentStatus}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await deleteExpense(e.id)
                            if (result.success) toast.success('Expense removed')
                            else toast.error(result.error ?? 'Delete failed')
                          })
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <ExpenseFormModal onClose={() => setCreating(false)} onDone={() => setCreating(false)} />
      )}
    </div>
  )
}

function ExpenseFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState('Operations')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [vendor, setVendor] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('paid')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await createExpense({
        category,
        description,
        amount: Number(amount),
        expenseDate,
        vendor: vendor || undefined,
        paymentStatus,
      })
      if (result.success) {
        toast.success('Expense saved')
        onDone()
      } else {
        setError(result.error ?? 'Could not save expense')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label="Add expense">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Add expense</h3>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <Field label="Category">
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="app-field w-full" />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="app-field w-full" />
        </Field>
        <Field label="Amount (₵)">
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="app-field w-full" />
        </Field>
        <Field label="Date">
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="app-field w-full" />
        </Field>
        <Field label="Vendor (optional)">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="app-field w-full" />
        </Field>
        <Field label="Payment status">
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'pending' | 'paid')} className="app-field w-full">
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">Cancel</button>
        <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">Save</button>
      </ModalFooter>
    </CenteredModal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}
