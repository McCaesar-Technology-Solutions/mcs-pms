/** Ghana cedi display with stable digit alignment in tables and summaries. */
export const MONEY_CLASS = 'tabular-nums'

export function formatGhs(value: number | null | undefined): string {
  return `₵${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatGhsCompact(value: number | null | undefined): string {
  return `₵${(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`
}
