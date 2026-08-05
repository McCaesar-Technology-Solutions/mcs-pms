import { BrandMark } from '@/components/brand/brand-mark'

interface PortalBrandProps {
  variant?: 'guest' | 'technician'
  className?: string
}

export function PortalBrand({ variant = 'guest', className = '' }: PortalBrandProps) {
  return (
    <div className={`portal-brand portal-brand--${variant} ${className}`.trim()}>
      <BrandMark variant="brand" />
      <span className="portal-brand__text">
        <span className="portal-brand__mojo">MOJO</span>
        <span className="portal-brand__apartments"> APARTMENTS</span>
      </span>
    </div>
  )
}
