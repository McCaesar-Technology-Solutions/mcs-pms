import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isStaffRole,
  ROLE_HOME,
  roleRequiredPath,
  STAFF_ROLES,
} from '@/lib/auth/roles'
import { legacyPathForRole } from '@/lib/auth/legacy-redirect'
import { isMfaPath } from '@/lib/auth/mfa'
import { mfaRedirectIfNeeded } from '@/lib/auth/mfa-server'
import type { Database } from '@/lib/supabase/types'
import type { UserRole } from '@/types'

const PUBLIC_PATHS = ['/login', '/accept-invite', '/signup', '/forgot-password']
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

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
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

  const { pathname } = request.nextUrl

  if (pathname.startsWith(GUEST_PREFIX)) {
    return supabaseResponse
  }

  // Password-recovery flow: the callback exchanges a code for a (recovery)
  // session, and the reset page must stay reachable while that session is
  // active — so never redirect these away based on auth state.
  if (pathname.startsWith('/auth/') || pathname === '/reset-password') {
    return supabaseResponse
  }

  if (isMfaPath(pathname)) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.is_active !== false && isStaffRole(profile?.role)) {
        const home = ROLE_HOME[profile.role]
        return NextResponse.redirect(new URL(home, request.url))
      }
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_active !== false && profile?.role && isStaffRole(profile.role)) {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active, phone, mfa_enabled, mfa_method, mfa_totp_secret')
      .eq('id', user.id)
      .maybeSingle()

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
      return supabaseResponse
    }

    if (profile.role !== required) {
      if (isStaffRole(profile.role)) {
        return NextResponse.redirect(new URL(ROLE_HOME[profile.role], request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const mfaRedirect = await mfaRedirectIfNeeded(
      supabase,
      user.id,
      {
        role: profile.role as UserRole,
        phone: profile.phone,
        mfa_enabled: profile.mfa_enabled,
        mfa_method: profile.mfa_method as import('@/lib/auth/mfa').MfaMethod | null,
        mfa_totp_secret: profile.mfa_totp_secret,
      },
      pathname,
      request.url,
    )
    if (mfaRedirect) return NextResponse.redirect(mfaRedirect)
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
  }

  return supabaseResponse
}
