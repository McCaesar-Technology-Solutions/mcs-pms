import type { Metadata } from 'next'
import { LegalDocumentPage } from '@/components/legal/legal-document-page'
import { LEGAL_LAST_UPDATED, termsSections } from '@/lib/legal/content'

export const metadata: Metadata = {
  title: 'Terms of Service — MOJO APARTMENTS',
  description: 'Terms governing use of the MOJO APARTMENTS property management platform.',
}

export default function TermsPage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      intro="These terms govern access to the MOJO APARTMENTS platform for property staff and guests. Your property operator remains responsible for hospitality services, bookings, and on-site safety."
      sections={termsSections}
      lastUpdated={LEGAL_LAST_UPDATED}
    />
  )
}
