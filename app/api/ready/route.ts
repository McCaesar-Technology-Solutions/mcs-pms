import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateCoreEnv, validateProductionEnv } from '@/lib/env'

export async function GET() {
  const core = validateCoreEnv()
  if (!core.ok) {
    return NextResponse.json({ status: 'not_ready', missing: core.missing }, { status: 503 })
  }

  if (process.env.NODE_ENV === 'production') {
    const prod = validateProductionEnv()
    if (!prod.ok) {
      return NextResponse.json({ status: 'not_ready', errors: prod.errors }, { status: 503 })
    }
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('hotels').select('id').limit(1)
    if (error) {
      return NextResponse.json({ status: 'not_ready', db: error.message }, { status: 503 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database unreachable'
    return NextResponse.json({ status: 'not_ready', db: message }, { status: 503 })
  }

  return NextResponse.json({ status: 'ready', timestamp: new Date().toISOString() })
}
