'use client'

import { useState, useTransition } from 'react'
import { Plus, Receipt, Trash2 } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { toast } from 'sonner'
import { createExpense, deleteExpense } from '@/app/actions/expenses'
import { expenseSummary, type ExpenseRow } from '@/lib/data/expenses'
import { formatGhs, MONEY_CLASS } from '@/lib/format/money'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
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
          <p className="text-xs font-medium text-muted-foreground">Total logged</p>
          <p className={`mt-1 text-2xl font-semibold text-foreground ${MONEY_CLASS}`}>
            {formatGhs(summary.total)}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <p className={`mt-1 text-2xl font-semibold text-foreground ${MONEY_CLASS}`}>
            {formatGhs(summary.paid)}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending</p>
          <p className={`mt-1 text-2xl font-semibold text-foreground ${MONEY_CLASS}`}>
            {formatGhs(summary.pending)}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        {expenses.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="app-btn app-btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        )}
      </div>

      <div className="surface-card overflow-hidden">
        {expenses.length === 0 ? (
          <DataEmptyState
            borderless
            icon={Receipt}
            title="No expenses yet"
            message="Log vendor payments and operating costs to keep spending visible."
            action={
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="app-btn app-btn-primary inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add first expense
              </button>
            }
          />
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {expenses.map((e) => (
                <div key={e.id} className="elevated-list-item p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{e.description}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{e.category}</p>
                      <p className="text-xs text-muted-foreground">{e.expenseDate}</p>
                      {e.vendor && (
                        <p className="mt-1 text-xs text-muted-foreground">Vendor: {e.vendor}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold text-foreground ${MONEY_CLASS}`}>
                        {formatGhs(e.amount)}
                      </p>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">{e.paymentStatus}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end border-t border-border pt-3">
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
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <div className="data-table-wrap px-4 pb-4 pt-2">
              <table className="data-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="text-muted-foreground">{e.expenseDate}</td>
                      <td>{e.category}</td>
                      <td>{e.description}</td>
                      <td className="text-muted-foreground">{e.vendor ?? '-'}</td>
                      <td className={`font-medium ${MONEY_CLASS}`}>{formatGhs(e.amount)}</td>
                      <td className="capitalize">{e.paymentStatus}</td>
                      <td>
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
          </div>
          </>
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
        <FormField label="Category">
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={APP_FIELD_CLASS} />
        </FormField>
        <FormField label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={APP_FIELD_CLASS} />
        </FormField>
        <FormField label="Amount (₵)">
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={APP_FIELD_CLASS} />
        </FormField>
        <FormField label="Date">
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={APP_FIELD_CLASS} />
        </FormField>
        <FormField label="Vendor (optional)">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} className={APP_FIELD_CLASS} />
        </FormField>
        <FormField label="Payment status">
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'pending' | 'paid')} className={APP_FIELD_CLASS}>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">Cancel</button>
        <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">Save</button>
      </ModalFooter>
    </CenteredModal>
  )
}
