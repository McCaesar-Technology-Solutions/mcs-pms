import { GRAReportsView } from '@/components/dashboard/gra-reports-view'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { computeGraReports, computeGraReportsSummary } from '@/lib/data/gra-reports'
import { getHotelExportInfo } from '@/lib/data/settings'

export default async function GRAReportsPage() {
  const [{ invoices }, hotel] = await Promise.all([getDashboardData(), getHotelExportInfo()])
  const reports = computeGraReports(invoices)
  const summary = computeGraReportsSummary(reports)

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Compliance"
        title="GRA Tax Reports"
        description="View tax filing status, compliance deadlines, and download reports for Ghana Revenue Authority."
      />

      <GRAReportsView reports={reports} summary={summary} invoices={invoices} hotel={hotel} />
    </div>
  )
}
