'use client'

interface BillToFieldsProps {
  guestName: string
  sameAsGuest: boolean
  onSameAsGuestChange: (value: boolean) => void
  billToName: string
  onBillToNameChange: (value: string) => void
}

export function BillToFields({
  guestName,
  sameAsGuest,
  onSameAsGuestChange,
  billToName,
  onBillToNameChange,
}: BillToFieldsProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={sameAsGuest}
          onChange={(e) => onSameAsGuestChange(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Bill to person same as guest?
          {sameAsGuest && guestName.trim() ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Bill to: {guestName.trim()}
            </span>
          ) : null}
        </span>
      </label>
      {!sameAsGuest && (
        <div>
          <label className="text-sm font-semibold">Bill to name</label>
          <input
            value={billToName}
            onChange={(e) => onBillToNameChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
            placeholder="Company or person to bill"
          />
        </div>
      )}
    </div>
  )
}
