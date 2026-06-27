interface MiniSparklineProps {
  values: number[]
  className?: string
  tone?: 'primary' | 'gold' | 'emerald' | 'amber'
}

const toneStroke: Record<NonNullable<MiniSparklineProps['tone']>, string> = {
  primary: 'stroke-primary/45',
  gold: 'stroke-[var(--brand-gold-dark)]/55',
  emerald: 'stroke-emerald-600/50',
  amber: 'stroke-amber-600/50',
}

const toneFill: Record<NonNullable<MiniSparklineProps['tone']>, string> = {
  primary: 'fill-primary/8',
  gold: 'fill-[var(--brand-gold)]/12',
  emerald: 'fill-emerald-500/10',
  amber: 'fill-amber-500/10',
}

export function MiniSparkline({ values, className = '', tone = 'primary' }: MiniSparklineProps) {
  if (values.length < 2) return null

  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const range = max - min || 1
  const width = 88
  const height = 32
  const pad = 2

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = pad + (height - pad * 2) - ((v - min) / range) * (height - pad * 2)
    return { x, y }
  })

  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${points.map((p) => `${p.x},${p.y}`).join(' ')} ${width - pad},${height} ${pad},${height}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-8 w-[5.5rem] shrink-0 ${className}`}
      aria-hidden
    >
      <polygon points={area} className={toneFill[tone]} />
      <polyline
        points={line}
        fill="none"
        className={toneStroke[tone]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
