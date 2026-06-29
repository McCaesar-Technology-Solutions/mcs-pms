'use server'

import { searchGlobal, type GlobalSearchResult } from '@/lib/data/global-search'

export async function searchGlobalAction(query: string): Promise<GlobalSearchResult[]> {
  return searchGlobal(query)
}
