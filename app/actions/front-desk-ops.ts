'use server'

import { loadFrontDeskOpsContext } from '@/lib/data/load-front-desk-ops'
import type { ExtendedTodayOperations } from '@/lib/data/front-desk-ops'

export async function loadFrontDeskOpsSnapshot(
  opsDate?: string | null,
): Promise<{ opsDate: string; ops: ExtendedTodayOperations } | null> {
  const ctx = await loadFrontDeskOpsContext(opsDate)
  if (!ctx) return null
  return { opsDate: ctx.opsDate, ops: ctx.ops }
}
