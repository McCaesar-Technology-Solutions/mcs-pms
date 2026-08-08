'use client'

import type { PayrollHistoryPoint } from '@/lib/payroll/types'

function formatMoneyShort(value: number) {
  if (value >= 1000) return `₵${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `₵${value.toFixed(0)}`
}

/** SVG line chart for payroll history (matches analytics chart style). */
export function PayrollHistoryChart({ data }: { data: PayrollHistoryPoint[] }) {
  const width = 420
  const height = 180
  const pad = { top: 20, right: 12, bottom: 32, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        Run payroll to see history
      </div>
    )
  }

  const max = Math.max(1, ...data.map((d) => d.net))
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW

  const points = data.map((d, i) => ({
    x: pad.left + i * step,
    y: pad.top + innerH - (d.net / max) * innerH,
    ...d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? pad.left} ${pad.top + innerH} L ${points[0]?.x ?? pad.left} ${pad.top + innerH} Z`

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[280px]"
        role="img"
        aria-label="Payroll history"
      >
        <defs>
          <linearGradient id="payrollAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E879A9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#E879A9" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#payrollAreaGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke="#E879A9"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <g key={`${p.periodStart}-${p.runId}`}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#E879A9" strokeWidth="2" />
            <title>{`${p.label}: ${formatMoneyShort(p.net)}`}</title>
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-[#5E5872] text-[10px] font-semibold"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
