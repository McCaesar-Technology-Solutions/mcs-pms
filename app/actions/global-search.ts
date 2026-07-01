'use server'

import { loadVerifiedStaffProfile } from '@/lib/auth/staff-session'
import { searchGlobal, type GlobalSearchResult } from '@/lib/data/global-search'

export async function searchGlobalAction(query: string): Promise<GlobalSearchResult[]> {
  const profile = await loadVerifiedStaffProfile()
  if (!profile) return []
  return searchGlobal(query)
}
