'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { upsertEmployeeCompensation } from '@/app/actions/payroll'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type { EmployeeCompensationRow, PayType } from '@/lib/payroll/types'
import type { Profile } from '@/types'

interface StaffPayProfileDialogProps {
  open: boolean
  onClose: () => void
  member: Profile
  initial?: EmployeeCompensationRow | null
}

export function StaffPayProfileDialog({
  open,
  onClose,
  member,
  initial,
}: StaffPayProfileDialogProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [payType, setPayType] = useState<PayType>(initial?.payType ?? 'salary')
  const [baseAmount, setBaseAmount] = useState(String(initial?.baseAmount ?? 0))
  const [momoNumber, setMomoNumber] = useState(initial?.momoNumber ?? '')
  const [bankName, setBankName] = useState(initial?.bankName ?? '')
  const [bankAccount, setBankAccount] = useState(initial?.bankAccount ?? '')
  const [tin, setTin] = useState(initial?.tin ?? '')
  const [ssnitNumber, setSsnitNumber] = useState(initial?.ssnitNumber ?? '')
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? '')
  const [payrollActive, setPayrollActive] = useState(initial?.payrollActive ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function handleSave() {
    const amount = Number(baseAmount)
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Enter a valid base amount.')
      return
    }

    startTransition(async () => {
      const result = await upsertEmployeeCompensation({
        profileId: member.id,
        payType,
        baseAmount: amount,
        momoNumber: momoNumber || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        tin: tin || null,
        ssnitNumber: ssnitNumber || null,
        hireDate: hireDate || null,
        payrollActive,
        notes: notes || null,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Pay profile saved for ${member.name}`)
      onClose()
      router.refresh()
    })
  }

  return (
    <CenteredModal open={open} onClose={onClose} className="max-w-lg" aria-label="Pay profile">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Pay profile · {member.name}</h3>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pay type">
            <select
              className={APP_FIELD_CLASS}
              value={payType}
              onChange={(e) => setPayType(e.target.value as PayType)}
            >
              <option value="salary">Salary (monthly)</option>
              <option value="daily">Daily rate</option>
              <option value="hourly">Hourly rate</option>
            </select>
          </FormField>
          <FormField
            label="Base amount (GHS)"
            hint="Full amount for the pay period (e.g. monthly salary), not an hourly rate × hours."
          >
            <input
              type="number"
              min={0}
              step="0.01"
              className={APP_FIELD_CLASS}
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
            />
          </FormField>
          <FormField label="MoMo number">
            <input
              className={APP_FIELD_CLASS}
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              placeholder="+233…"
            />
          </FormField>
          <FormField label="Hire date">
            <input
              type="date"
              className={APP_FIELD_CLASS}
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </FormField>
          <FormField label="Bank name">
            <input
              className={APP_FIELD_CLASS}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </FormField>
          <FormField label="Bank account">
            <input
              className={APP_FIELD_CLASS}
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
            />
          </FormField>
          <FormField label="TIN">
            <input className={APP_FIELD_CLASS} value={tin} onChange={(e) => setTin(e.target.value)} />
          </FormField>
          <FormField label="SSNIT number">
            <input
              className={APP_FIELD_CLASS}
              value={ssnitNumber}
              onChange={(e) => setSsnitNumber(e.target.value)}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={payrollActive}
            onChange={(e) => setPayrollActive(e.target.checked)}
            className="rounded border-border"
          />
          Include in payroll runs
        </label>
        <FormField label="Notes">
          <textarea
            className={APP_FIELD_CLASS}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="app-btn app-btn-primary disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save pay profile'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}
