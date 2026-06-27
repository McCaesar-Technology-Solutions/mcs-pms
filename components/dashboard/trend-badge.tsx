import { TrendingDown, TrendingUp } from 'lucide-react'

interface TrendBadgeProps {
  value: number | null
  label?: string
  className?: string
  onDark?: boolean
}

export function TrendBadge({ value, label = 'vs last month', className = '', onDark = false }: TrendBadgeProps) {
  if (value == null) return null

  const up = value >= 0

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        onDark
          ? up
            ? 'bg-emerald-400/15 text-emerald-300'
            : 'bg-orange-400/15 text-orange-300'
          : up
            ? 'bg-emerald-500/10 text-emerald-700'
            : 'bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]'
      } ${className}`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {value}%
      {label && <span className="font-medium opacity-75">{label}</span>}
    </span>
  )
}
