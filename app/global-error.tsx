'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-[#22124C] px-6 text-center text-white">
        <h1 className="text-xl font-semibold">Application error</h1>
        <p className="mt-2 max-w-md text-sm text-white/70">
          {error.message || 'A critical error occurred.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-[#D4A62E] px-5 py-2.5 text-sm font-semibold text-[#22124C]"
        >
          Reload
        </button>
      </body>
    </html>
  )
}
