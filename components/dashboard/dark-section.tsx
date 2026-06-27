import type { ReactNode } from 'react'

type DarkSectionVariant = 'ops' | 'depth' | 'inset'

interface DarkSectionProps {
  children: ReactNode
  variant?: DarkSectionVariant
  className?: string
}

const variantClass: Record<DarkSectionVariant, string> = {
  ops: 'dark-surface-band dark-surface-band--ops',
  depth: 'dark-surface-band dark-surface-band--depth',
  inset: 'dark-surface-band dark-surface-band--inset',
}

export function DarkSection({ children, variant = 'depth', className = '' }: DarkSectionProps) {
  const isInset = variant === 'inset'

  return (
    <section className={`${variantClass[variant]} ${className}`.trim()}>
      <div className={isInset ? 'dark-surface-band__inset' : 'dark-surface-band__inner page-shell'}>
        {children}
      </div>
    </section>
  )
}
