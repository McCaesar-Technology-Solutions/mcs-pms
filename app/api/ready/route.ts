import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateCoreEnv, validateProductionEnv } from '@/lib/env'

export async function GET() {
  const core = validateCoreEnv()
  if (!core.ok) {
    console.error('[ready] Missing core env:', core.missing.join(', '))
    return NextResponse.json({ status: 'not_ready' }, { status: 503 })
  }

  if (process.env.NODE_ENV === 'production') {
    const prod = validateProductionEnv()
    if (!prod.ok) {
      console.error('[ready] Production env validation failed:', prod.errors.join('; '))
      return NextResponse.json({ status: 'not_ready' }, { status: 503 })
    }
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('hotels').select('id').limit(1)
    if (error) {
      console.error('[ready] Database check failed:', error.message)
      return NextResponse.json({ status: 'not_ready' }, { status: 503 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database unreachable'
    console.error('[ready] Database unreachable:', message)
    return NextResponse.json({ status: 'not_ready' }, { status: 503 })
  }

  return NextResponse.json({ status: 'ready', timestamp: new Date().toISOString() })
}
