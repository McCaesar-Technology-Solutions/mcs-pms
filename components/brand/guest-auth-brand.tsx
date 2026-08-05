import { BrandMark } from '@/components/brand/brand-mark'

interface GuestAuthBrandProps {
  className?: string
  size?: 'default' | 'large'
}

/** Purple brand mark + wordmark for light guest auth screens. */
export function GuestAuthBrand({ className = '', size = 'default' }: GuestAuthBrandProps) {
  return (
    <p
      className={`guest-auth-brand ${size === 'large' ? 'text-3xl' : ''} ${className}`.trim()}
    >
      <BrandMark
        variant="brand"
        className={size === 'large' ? '!h-10 !w-auto' : '!h-8 !w-auto'}
      />
      <span>MOJO APARTMENTS</span>
    </p>
  )
}
