import { FrontDeskOpsStrip } from '@/components/dashboard/front-desk-ops-strip'
import { loadFrontDeskOpsContext } from '@/lib/data/load-front-desk-ops'
import type { StaffRoutePrefix } from '@/lib/data/front-desk-ops'

interface FrontDeskOpsSectionProps {
  routePrefix: StaffRoutePrefix
  opsDateParam?: string | null
  title?: string
}

export async function FrontDeskOpsSection({
  routePrefix,
  opsDateParam,
  title = 'Front desk',
}: FrontDeskOpsSectionProps) {
  const ctx = await loadFrontDeskOpsContext(opsDateParam)
  if (!ctx) return null

  return (
    <FrontDeskOpsStrip
      ops={ctx.ops}
      opsDate={ctx.opsDate}
      routePrefix={routePrefix}
      title={title}
    />
  )
}
