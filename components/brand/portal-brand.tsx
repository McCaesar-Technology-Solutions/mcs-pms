import { SidebarLogo } from '@/components/brand/sidebar-logo'

interface PortalBrandProps {
  variant?: 'guest' | 'technician'
  className?: string
}

export function PortalBrand({ variant = 'guest', className = '' }: PortalBrandProps) {
  return (
    <div className={`portal-brand portal-brand--${variant} ${className}`.trim()}>
      <SidebarLogo />
      <span className="portal-brand__text">
        <span className="portal-brand__mojo">MOJO</span>
        <span className="portal-brand__apartments"> APARTMENTS</span>
      </span>
    </div>
  )
}
