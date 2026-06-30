import type { HelpTopic } from '@/lib/help/types'

export const technicianHelpTopics: HelpTopic[] = [
  {
    id: 'tasks',
    title: 'My tasks screen',
    summary: 'Maintenance jobs and housekeeping work.',
    steps: [
      'Tasks shows complaints assigned to you and housekeeping jobs.',
      'Tap a card to open details, message the guest, or update status.',
      'Use ⌘K to search by room number or category.',
      'Bottom bar switches between Tasks and Messages.',
    ],
    href: '/technician/tasks',
    hrefLabel: 'Open tasks',
    keywords: ['tasks', 'jobs', 'home'],
  },
  {
    id: 'complaints',
    title: 'Maintenance complaint flow',
    summary: 'Fix guest-reported issues.',
    steps: [
      'Open the job → review category and guest notes.',
      'Message the guest from the job if you need access or details.',
      'Submit your invoice when work is done — manager approves payment.',
      'Mark complete when finished; manager gives final approval.',
    ],
    href: '/technician/tasks',
    hrefLabel: 'Open tasks',
    keywords: ['complaint', 'repair', 'maintenance', 'invoice'],
    pathPrefixes: ['/technician/tasks'],
  },
  {
    id: 'housekeeping',
    title: 'Housekeeping tasks',
    summary: 'Room cleaning after checkout.',
    steps: [
      'Claim or accept housekeeping tasks from the pool.',
      'Update status as you clean — managers see progress on the board.',
      'Checkout automatically creates clean tasks for departed rooms.',
    ],
    href: '/technician/tasks',
    hrefLabel: 'Open tasks',
    keywords: ['housekeeping', 'cleaning', 'room'],
    pathPrefixes: ['/technician/tasks'],
  },
  {
    id: 'messages',
    title: 'Team messages',
    summary: 'Chat with managers — not guest billing.',
    steps: [
      'Messages tab — coordinate with managers on assignments.',
      'Guest chat for a specific repair is inside each complaint job.',
      'Add your phone number so SMS alerts reach you for new jobs.',
    ],
    href: '/technician/messages',
    hrefLabel: 'Open messages',
    keywords: ['messages', 'chat', 'sms', 'phone'],
    pathPrefixes: ['/technician/messages'],
  },
  {
    id: 'phone',
    title: 'Phone and alerts',
    summary: 'Stay reachable for new assignments.',
    steps: [
      'Tap Phone or the banner to add or verify your number.',
      'You receive SMS when managers assign jobs or approve invoices.',
      'Call manager button reaches property managers directly.',
    ],
    href: '/technician/tasks',
    hrefLabel: 'Open tasks',
    keywords: ['phone', 'sms', 'alert', 'contact'],
  },
]
