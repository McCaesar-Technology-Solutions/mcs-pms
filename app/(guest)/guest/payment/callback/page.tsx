import { verifyAndRedirectGuestPayment } from '@/app/actions/payments'

export default async function GuestPaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const { reference } = await searchParams
  await verifyAndRedirectGuestPayment(reference ?? '')
}
