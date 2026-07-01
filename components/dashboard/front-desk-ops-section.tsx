import { FrontDeskOpsStripLive } from '@/components/dashboard/front-desk-ops-strip-live'
import { loadFrontDeskOpsContext, type FrontDeskOpsContext } from '@/lib/data/load-front-desk-ops'
import type { StaffRoutePrefix } from '@/lib/data/front-desk-ops'

interface FrontDeskOpsSectionProps {
  routePrefix: StaffRoutePrefix
  opsDateParam?: string | null
  title?: string
  initialContext?: FrontDeskOpsContext | null
}

export async function FrontDeskOpsSection({
  routePrefix,
  opsDateParam,
  title = 'Front desk',
  initialContext,
}: FrontDeskOpsSectionProps) {
  const ctx = initialContext ?? (await loadFrontDeskOpsContext(opsDateParam))
  if (!ctx) return null

  return (
    <FrontDeskOpsStripLive
      initialOps={ctx.ops}
      opsDate={ctx.opsDate}
      routePrefix={routePrefix}
      title={title}
    />
  )
}
