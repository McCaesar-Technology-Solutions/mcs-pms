import Link from 'next/link'

interface LegalSection {
  title: string
  body: string
}

interface LegalDocumentPageProps {
  title: string
  intro: string
  sections: readonly LegalSection[]
  lastUpdated: string
}

export function LegalDocumentPage({ title, intro, sections, lastUpdated }: LegalDocumentPageProps) {
  return (
    <div className="min-h-dvh bg-[#22124C] text-white">
      <header className="border-b border-white/10 px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/login"
            className="text-sm font-semibold text-[#D4A62E] hover:underline"
          >
            ← Back to sign in
          </Link>
          <p
            className="mt-6 text-3xl font-semibold text-[#D4A62E]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
            MOJO APARTMENTS
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-white/60">Last updated: {lastUpdated}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-base leading-relaxed text-white/80">{intro}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-[#D4A62E]">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-8 text-sm text-white/60">
          <Link href="/privacy" className="hover:text-[#D4A62E] hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[#D4A62E] hover:underline">
            Terms of Service
          </Link>
          <Link href="/login" className="hover:text-[#D4A62E] hover:underline">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  )
}
