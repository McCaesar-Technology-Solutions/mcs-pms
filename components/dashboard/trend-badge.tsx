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
            ? 'bg-[rgba(var(--glow-gold),0.18)] text-[var(--brand-gold-light)]'
            : 'bg-white/10 text-white/70'
          : up
            ? 'bg-[rgba(var(--glow-gold),0.12)] text-[var(--brand-gold-dark)]'
            : 'bg-[rgba(var(--glow-purple),0.08)] text-[var(--primary)]'
      } ${className}`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {value}%
      {label && <span className="font-medium opacity-75">{label}</span>}
    </span>
  )
}
