import type { Metadata } from 'next'
import { LegalDocumentPage } from '@/components/legal/legal-document-page'
import { LEGAL_LAST_UPDATED, privacySections } from '@/lib/legal/content'

export const metadata: Metadata = {
  title: 'Privacy Policy — MOJO APARTMENTS',
  description: 'How MOJO APARTMENTS processes personal data for hospitality operations in Ghana.',
}

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      intro="This policy explains how personal data is collected and used when you use the MOJO APARTMENTS property management platform as a guest or staff member, in line with Ghana's Data Protection Act, 2012 (Act 843)."
      sections={privacySections}
      lastUpdated={LEGAL_LAST_UPDATED}
    />
  )
}
