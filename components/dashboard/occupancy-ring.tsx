interface OccupancyRingProps {
  percent: number
  size?: number
  className?: string
  showLabel?: boolean
}

function ringTone(percent: number) {
  if (percent >= 70) return { stroke: 'stroke-emerald-500', track: 'stroke-emerald-500/15' }
  if (percent < 40) return { stroke: 'stroke-amber-500', track: 'stroke-amber-500/15' }
  return { stroke: 'stroke-[var(--brand-gold-dark)]', track: 'stroke-[var(--brand-gold)]/20' }
}

export function OccupancyRing({
  percent,
  size = 56,
  className = '',
  showLabel = true,
}: OccupancyRingProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const tone = ringTone(clamped)

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={tone.track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={`${tone.stroke} transition-all duration-700 ease-out`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-foreground ${
          showLabel ? '' : 'sr-only'
        }`}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  )
}
