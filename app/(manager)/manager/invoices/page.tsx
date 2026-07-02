import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PageHeader } from '@/components/dashboard/page-header'
import { getInvoicesData } from '@/lib/data/billing'
import { getHotelExportInfo } from '@/lib/data/settings'

export default async function ManagerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>
}) {
  const { q, open } = await searchParams
  const [invoices, hotel] = await Promise.all([getInvoicesData(), getHotelExportInfo()])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Finance"
        title="Invoices"
        description="View and print guest invoices from check-outs and other charges."
      />

      <BillingOverview
        invoices={invoices}
        hotel={hotel}
        initialQuery={q}
        openInvoiceId={open}
        vatMode={hotel?.vatMode ?? 'exclusive'}
        readOnly
      />
    </div>
  )
}
