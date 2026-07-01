'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadFrontDeskOpsSnapshot } from '@/app/actions/front-desk-ops'
import { FrontDeskOpsStrip } from '@/components/dashboard/front-desk-ops-strip'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import type { ExtendedTodayOperations, StaffRoutePrefix } from '@/lib/data/front-desk-ops'

interface FrontDeskOpsStripLiveProps {
  initialOps: ExtendedTodayOperations
  opsDate: string
  routePrefix: StaffRoutePrefix
  title?: string
  showDateSelector?: boolean
}

export function FrontDeskOpsStripLive({
  initialOps,
  opsDate,
  routePrefix,
  title,
  showDateSelector = true,
}: FrontDeskOpsStripLiveProps) {
  const [ops, setOps] = useState(initialOps)

  useEffect(() => {
    setOps(initialOps)
  }, [initialOps])

  const refresh = useCallback(async () => {
    const snapshot = await loadFrontDeskOpsSnapshot(opsDate)
    if (snapshot) setOps(snapshot.ops)
  }, [opsDate])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRealtimeRefresh('layout', refresh)
  useRealtimeRefresh('guest_portal', refresh)
  useRealtimeRefresh('messages', refresh)
  useRealtimeRefresh('housekeeping', refresh)
  useRealtimeRefresh('complaints', refresh)

  return (
    <FrontDeskOpsStrip
      ops={ops}
      opsDate={opsDate}
      routePrefix={routePrefix}
      title={title}
      showDateSelector={showDateSelector}
    />
  )
}
