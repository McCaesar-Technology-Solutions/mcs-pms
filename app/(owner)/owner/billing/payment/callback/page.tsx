import { verifyAndRedirectStaffPayment } from '@/app/actions/payments'

export default async function StaffPaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const { reference } = await searchParams
  await verifyAndRedirectStaffPayment(reference ?? '')
}
