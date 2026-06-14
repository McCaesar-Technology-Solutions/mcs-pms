'use client'

import { useCallback, useState } from 'react'
import { getHotelComplaints } from '@/app/actions/complaints'
import { ComplaintsOverview } from '@/components/complaints/complaints-overview'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import type { Complaint } from '@/types'

interface ComplaintsOverviewLiveProps {
  initialComplaints: Complaint[]
  limit?: number
  complaintsHref?: string
}

/** Dashboard complaints snapshot — refetches on realtime events without full page reload. */
export function ComplaintsOverviewLive({
  initialComplaints,
  limit = 5,
  complaintsHref,
}: ComplaintsOverviewLiveProps) {
  const [complaints, setComplaints] = useState(initialComplaints)

  const refresh = useCallback(async () => {
    const result = await getHotelComplaints()
    if (result.success && result.data) setComplaints(result.data)
  }, [])

  useRealtimeRefresh('complaints', refresh)
  useRealtimeRefresh('layout', refresh)

  return <ComplaintsOverview complaints={complaints} limit={limit} complaintsHref={complaintsHref} />
}
