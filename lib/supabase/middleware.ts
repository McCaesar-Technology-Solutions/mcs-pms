import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isStaffRole,
  ROLE_HOME,
  roleRequiredPath,
  STAFF_ROLES,
} from '@/lib/auth/roles'
import { legacyPathForRole } from '@/lib/auth/legacy-redirect'
import {
  isMfaPath,
  mfaGateForRole,
  mfaRedirectPath,
  type MfaMethod,
} from '@/lib/auth/mfa'
import { buildMfaStatus } from '@/lib/auth/mfa-status'
import { mfaRedirectIfNeeded } from '@/lib/auth/mfa-server'
import type { Database } from '@/lib/supabase/types'
import type { UserRole } from '@/types'

const PUBLIC_PATHS = ['/login', '/accept-invite', '/signup', '/forgot-password', '/privacy', '/terms']
const GUEST_PREFIX = '/guest'

const LEGACY_STAFF_PATHS = [
  '/dashboard',
  '/reservations',
  '/bookings',
  '/guests',
  '/housekeeping',
  '/billing',
  '/channels',
  '/gra-reports',
  '/analytics',
  '/settings',
]

async function loadStaffProfile(supabase: ReturnType<typeof createServerClient<Database>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, phone, email, mfa_enabled, mfa_method, mfa_totp_secret, onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.role) return null

  return {
    role: profile.role as UserRole,
    is_active: profile.is_active,
    phone: profile.phone,
    email: profile.email,
    mfa_enabled: profile.mfa_enabled,
    mfa_method: profile.mfa_method as MfaMethod | null,
    mfa_totp_secret: profile.mfa_totp_secret,
    onboarding_completed_at: profile.onboarding_completed_at,
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/health') || pathname.startsWith('/api/ready') || pathname.startsWith('/api/ical')) {
    return NextResponse.next({ request })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse('Service misconfigured', { status: 503 })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (pathname.startsWith(GUEST_PREFIX)) {
    return supabaseResponse
  }

  if (pathname.startsWith('/auth/') || pathname === '/reset-password') {
    return supabaseResponse
  }

  if (isMfaPath(pathname)) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const profile = await loadStaffProfile(supabase, user.id)
    if (!profile || profile.is_active === false) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const status = await buildMfaStatus(supabase, user.id, profile)
    const gate = mfaGateForRole(profile.role, status)

    if (gate === 'verify' && pathname.startsWith('/verify-mfa')) {
      return supabaseResponse
    }
    if (gate === 'enroll' && pathname.startsWith('/enroll-mfa')) {
      return supabaseResponse
    }
    if (gate === 'ok') {
      return NextResponse.redirect(new URL(ROLE_HOME[profile.role], request.url))
    }

    const target = mfaRedirectPath(profile.role, status, ROLE_HOME[profile.role])
    return NextResponse.redirect(new URL(target, request.url))
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (user) {
      const profile = await loadStaffProfile(supabase, user.id)
      if (profile?.is_active !== false && profile && isStaffRole(profile.role)) {
        const mfaTarget = await mfaRedirectIfNeeded(
          supabase,
          user.id,
          profile,
          ROLE_HOME[profile.role],
          request.url,
        )
        if (mfaTarget) {
          return NextResponse.redirect(mfaTarget)
        }
        return NextResponse.redirect(new URL(ROLE_HOME[profile.role], request.url))
      }
    }
    return supabaseResponse
  }

  if (pathname.startsWith('/get-started')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', '/get-started')
      return NextResponse.redirect(loginUrl)
    }

    const profile = await loadStaffProfile(supabase, user.id)
    if (!profile || profile.is_active === false || profile.role !== 'owner') {
      if (profile && isStaffRole(profile.role)) {
        return NextResponse.redirect(new URL(ROLE_HOME[profile.role], request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (profile.onboarding_completed_at) {
      return NextResponse.redirect(new URL('/owner/dashboard', request.url))
    }

    return supabaseResponse
  }

  const required = roleRequiredPath(pathname)
  const isLegacyStaff =
    LEGACY_STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (isLegacyStaff) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const profile = await loadStaffProfile(supabase, user.id)
    if (profile?.is_active !== false && profile && isStaffRole(profile.role)) {
      const target = legacyPathForRole(pathname, profile.role)
      return NextResponse.redirect(new URL(target, request.url))
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (required) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const profile = await loadStaffProfile(supabase, user.id)

    if (!profile || profile.is_active === false) {
      await supabase.auth.signOut()
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'disabled')
      return NextResponse.redirect(loginUrl)
    }

    if (required === 'staff') {
      if (!STAFF_ROLES.includes(profile.role)) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } else if (profile.role !== required) {
      if (isStaffRole(profile.role)) {
        return NextResponse.redirect(new URL(ROLE_HOME[profile.role], request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const mfaTarget = await mfaRedirectIfNeeded(
      supabase,
      user.id,
      profile,
      pathname,
      request.url,
    )
    if (mfaTarget) {
      return NextResponse.redirect(mfaTarget)
    }

    if (
      profile.role === 'owner' &&
      !profile.onboarding_completed_at &&
      !pathname.startsWith('/get-started')
    ) {
      return NextResponse.redirect(new URL('/get-started', request.url))
    }

    return supabaseResponse
  }

  if (
    pathname.startsWith('/owner') ||
    pathname.startsWith('/manager') ||
    pathname.startsWith('/technician') ||
    pathname.startsWith('/receptionist')
  ) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const profile = await loadStaffProfile(supabase, user.id)
    if (profile && profile.is_active !== false) {
      const mfaTarget = await mfaRedirectIfNeeded(
        supabase,
        user.id,
        profile,
        pathname,
        request.url,
      )
      if (mfaTarget) {
        return NextResponse.redirect(mfaTarget)
      }
    }
  }

  return supabaseResponse
}
