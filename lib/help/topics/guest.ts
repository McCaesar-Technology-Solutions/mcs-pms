import type { HelpTopic } from '@/lib/help/types'

export const guestHelpTopics: HelpTopic[] = [
  {
    id: 'portal',
    title: 'Using the guest portal',
    summary: 'Five tabs at the bottom of your screen.',
    steps: [
      'Home — Wi-Fi, quick actions, contact the property.',
      'Messages — chat with the front desk.',
      'My stay — dates, requests, and invoices.',
      'Issues — report maintenance problems.',
      'Account — phone, feedback, rules, and local guide.',
    ],
    keywords: ['tabs', 'navigation', 'home'],
  },
  {
    id: 'wifi',
    title: 'Wi-Fi and essentials',
    summary: 'Find network details on Home.',
    steps: [
      'Open the Home tab.',
      'Wi-Fi name and password are listed under Essentials.',
      'Parking and emergency phone are on the same screen.',
    ],
    keywords: ['wifi', 'password', 'internet', 'parking', 'emergency'],
  },
  {
    id: 'requests',
    title: 'Request housekeeping or late checkout',
    summary: 'Ask the front desk from My stay.',
    steps: [
      'Go to My stay → submit a request (housekeeping, late checkout, extension).',
      'Staff see requests on their dashboard and will confirm.',
      'Self check-out requests still require settling any balance at the desk.',
    ],
    keywords: ['housekeeping', 'late checkout', 'extension', 'request'],
  },
  {
    id: 'issues',
    title: 'Report a maintenance issue',
    summary: 'Issues tab — not the same as general Messages.',
    steps: [
      'Open Issues → pick a category and describe the problem (10+ characters).',
      'Track status on the same tab.',
      'Use Message staff inside an issue for updates about that repair.',
      'For general questions (towels, checkout time), use Messages instead.',
    ],
    keywords: ['issue', 'complaint', 'maintenance', 'repair', 'broken'],
  },
  {
    id: 'messages',
    title: 'Message the front desk',
    summary: 'General stay questions.',
    steps: [
      'Open Messages to chat with reception.',
      'Do not use Messages for a specific repair — use Issues for that.',
      'Badges show when staff reply.',
    ],
    keywords: ['message', 'chat', 'front desk', 'reception'],
  },
  {
    id: 'access',
    title: 'Portal link stopped working',
    summary: 'When your link expires.',
    steps: [
      'Links expire after checkout or when staff checks you out.',
      'Ask the front desk for a new link or QR code.',
      'Lobby QR: enter room number and last name at the property join page.',
    ],
    keywords: ['expired', 'link', 'qr', 'login', 'access'],
  },
]
