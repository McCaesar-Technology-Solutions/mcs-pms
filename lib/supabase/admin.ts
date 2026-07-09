import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** SSR-safe admin client — returns null instead of throwing when env is misconfigured. */
export function tryCreateAdminClient(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient()
  } catch (err) {
    console.error('[supabase] admin client unavailable:', err)
    return null
  }
}
