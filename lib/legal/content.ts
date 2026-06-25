export const LEGAL_LAST_UPDATED = '15 June 2026'

export const privacySections = [
  {
    title: 'Who we are',
    body: `MOJO APARTMENTS Property Management System ("the Platform") is operated by your hospitality property and its authorised staff. When you stay as a guest or register as staff, your property controller is responsible for how your personal data is used for your stay and account.`,
  },
  {
    title: 'Data we collect',
    body: `We process: name, email, phone, room assignment, stay dates, booking channel, complaint and service requests, pre-arrival information (including optional ID uploads), invoice and payment status, and staff account details (role, phone for SMS alerts). Payment card data is handled by Paystack — we do not store full card numbers.`,
  },
  {
    title: 'Why we use your data',
    body: `To operate front desk and housekeeping, fulfil guest requests, calculate GRA-compliant invoices, send stay-related SMS or email, secure staff accounts (including two-factor authentication), and meet lawful record-keeping for hospitality and tax purposes in Ghana.`,
  },
  {
    title: 'Legal basis (Ghana)',
    body: `Processing is based on contract (providing your stay or staff employment), legitimate interests (property security and operations), and legal obligation (tax and regulatory records). Where required, you are asked to accept property house rules before using the guest portal.`,
  },
  {
    title: 'Retention',
    body: `Stay and invoice records are kept as required for GRA reporting and dispute resolution. Pre-arrival ID documents should be deleted after check-in unless your property policy requires longer retention. Owners may export or erase guest personal data from the staff dashboard subject to legal hold requirements.`,
  },
  {
    title: 'Your rights',
    body: `You may request access, correction, or erasure of personal data held about you, subject to legal retention limits. Contact the property front desk or owner in the first instance. You may lodge a complaint with the Data Protection Commission of Ghana if you believe your data has been mishandled.`,
  },
  {
    title: 'Security',
    body: `Staff access is role-based with row-level database isolation per property. Guest portal access uses signed session tokens. Owner and manager accounts require two-factor authentication in production. Rate limits apply to sign-in and guest portal entry.`,
  },
  {
    title: 'Contact',
    body: `For privacy questions, contact your property manager or the account owner listed in your booking confirmation.`,
  },
] as const

export const termsSections = [
  {
    title: 'Acceptance',
    body: `By creating a staff account, accepting a staff invite, or using the guest portal, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Platform.`,
  },
  {
    title: 'Staff accounts',
    body: `Staff accounts are invite-only (except owner self-registration where enabled). You must keep credentials confidential and complete required two-factor authentication. You are responsible for actions taken under your account.`,
  },
  {
    title: 'Guest portal',
    body: `Guest portal access is limited to your current stay window. Do not share portal links. Room entry may require verification of your surname. Self-service check-out requests are subject to front desk confirmation and payment settlement.`,
  },
  {
    title: 'Acceptable use',
    body: `You may not attempt to access other properties' data, bypass authentication, scrape the service, or upload unlawful content. Complaint photos and documents must relate to legitimate property issues.`,
  },
  {
    title: 'Payments',
    body: `Online payments are processed by Paystack. Property staff may also record manual payments (cash, mobile money, card). Invoice totals include applicable Ghana taxes (NHIL, GETFund, COVID levy, VAT) as configured for the property.`,
  },
  {
    title: 'Availability',
    body: `The Platform is provided for hospitality operations. We do not guarantee uninterrupted service. Planned maintenance and third-party outages (SMS, email, payment providers) may affect notifications or payments.`,
  },
  {
    title: 'Limitation of liability',
    body: `To the extent permitted by Ghana law, the Platform is provided "as is" for operational use by the property. Liability for guest injury, property damage, or booking disputes remains with the hospitality operator, not the software provider.`,
  },
  {
    title: 'Changes',
    body: `We may update these Terms. Material changes will be reflected on this page with an updated date. Continued use after changes constitutes acceptance.`,
  },
] as const
