import Link from 'next/link'
import { BrandMark } from '@/components/brand/brand-mark'

interface AuthBrandProps {
  /** Optional subtitle under the wordmark (e.g. "Staff sign in"). */
  subtitle?: string
  className?: string
  asLink?: boolean
  href?: string
}

/** Gold mark + wordmark for dark auth / MFA / invite shells. */
export function AuthBrand({
  subtitle,
  className = '',
  asLink = false,
  href = '/login',
}: AuthBrandProps) {
  const title = (
    <span className="auth-brand-title">
      <BrandMark variant="gold" className="!h-9 !w-auto" />
      <span>MOJO APARTMENTS</span>
    </span>
  )

  return (
    <div className={`mb-8 text-center ${className}`.trim()}>
      {asLink ? (
        <Link href={href} className="inline-block hover:opacity-90">
          {title}
        </Link>
      ) : (
        <p className="m-0">{title}</p>
      )}
      {subtitle ? <p className="mt-2 text-sm text-white/75">{subtitle}</p> : null}
    </div>
  )
}
