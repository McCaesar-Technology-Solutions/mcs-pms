import Link from 'next/link'

/** Paystack redirects here after staff/shared-device checkout. Webhook is source of truth. */
export default function PaymentCompletePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-serif text-3xl tracking-tight">Payment submitted</h1>
      <p className="text-muted-foreground">
        If you completed payment, your receipt will update shortly. You can close this window or
        return to the desk.
      </p>
      <Link href="/" className="btn-primary w-fit">
        Back to home
      </Link>
    </main>
  )
}
