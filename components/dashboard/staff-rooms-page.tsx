import { Suspense } from 'react'
import { RoomsManager } from '@/components/dashboard/rooms-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { FrontDeskOpsStrip } from '@/components/dashboard/front-desk-ops-strip'
import { loadRoomsPageData } from '@/lib/data/rooms-page'
import type { StaffRoutePrefix } from '@/lib/data/front-desk-ops'

interface StaffRoomsPageProps {
  routePrefix: StaffRoutePrefix
  badge: string
  title: string
  description: string
  statusOnly?: boolean
  canDelete?: boolean
  defaultView?: 'grid' | 'floor'
  searchParams: Promise<{ q?: string; view?: string; filter?: string; opsDate?: string }>
}

export async function StaffRoomsPage({
  routePrefix,
  badge,
  title,
  description,
  statusOnly = false,
  canDelete = false,
  defaultView = 'floor',
  searchParams,
}: StaffRoomsPageProps) {
  const params = await searchParams
  const pageData = await loadRoomsPageData(routePrefix, params)

  const opsStrip = (
    <FrontDeskOpsStrip
      ops={pageData.ops}
      opsDate={pageData.opsDate}
      routePrefix={routePrefix}
      title="Front desk snapshot"
      showDateSelector={false}
    />
  )

  return (
    <div className="page-shell page-content-stack">
      <PageHeader badge={badge} title={title} description={description} />
      {opsStrip}
      <Suspense fallback={null}>
        <RoomsManager
          rooms={pageData.dbRooms}
          categories={pageData.categories}
          canDelete={canDelete}
          statusOnly={statusOnly}
          initialSearch={pageData.initialSearch}
          routePrefix={pageData.routePrefix}
          opsDate={pageData.opsDate}
          initialView={pageData.initialView ?? defaultView}
          filter={pageData.filter}
          roomSignals={pageData.roomSignals}
        />
      </Suspense>
    </div>
  )
}
