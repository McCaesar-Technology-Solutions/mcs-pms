'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedMetricProps {
  value: number
  format: (value: number) => string
  className?: string
  duration?: number
}

export function AnimatedMetric({
  value,
  format,
  className = '',
  duration = 700,
}: AnimatedMetricProps) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from prior display to new value
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
