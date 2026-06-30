import type { HelpPack, HelpRole, HelpTopic } from '@/lib/help/types'
import { guestHelpTopics } from '@/lib/help/topics/guest'
import { managerHelpTopics } from '@/lib/help/topics/manager'
import { ownerHelpTopics } from '@/lib/help/topics/owner'
import { receptionistHelpTopics } from '@/lib/help/topics/receptionist'
import { technicianHelpTopics } from '@/lib/help/topics/technician'
import type { UserRole } from '@/types'

const PACKS: Record<HelpRole, HelpPack> = {
  owner: {
    role: 'owner',
    title: 'Owner assistant',
    subtitle: 'Billing, compliance, settings, and portfolio',
    topics: ownerHelpTopics,
  },
  manager: {
    role: 'manager',
    title: 'Manager assistant',
    subtitle: 'Daily operations for your property',
    topics: managerHelpTopics,
  },
  receptionist: {
    role: 'receptionist',
    title: 'Front desk assistant',
    subtitle: 'Bookings, check-in, checkout, and guests',
    topics: receptionistHelpTopics,
  },
  technician: {
    role: 'technician',
    title: 'Technician assistant',
    subtitle: 'Tasks, complaints, and housekeeping jobs',
    topics: technicianHelpTopics,
  },
  guest: {
    role: 'guest',
    title: 'Guest assistant',
    subtitle: 'Your stay, requests, and the portal',
    topics: guestHelpTopics,
  },
}

export function getHelpPack(role: UserRole | 'guest'): HelpPack {
  return PACKS[role] ?? PACKS.receptionist
}

export function getRoleLabel(role: HelpRole): string {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'manager':
      return 'Manager'
    case 'receptionist':
      return 'Front desk'
    case 'technician':
      return 'Technician'
    case 'guest':
      return 'Guest'
    default:
      return 'Help'
  }
}

function topicMatchesQuery(topic: HelpTopic, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    topic.title,
    topic.summary,
    ...topic.steps,
    ...topic.keywords,
  ]
    .join(' ')
    .toLowerCase()
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

function topicMatchesPath(topic: HelpTopic, pathname: string): boolean {
  if (!topic.pathPrefixes?.length) return false
  return topic.pathPrefixes.some((prefix) => pathname.startsWith(prefix))
}

/** Topics relevant to the current page, then the rest. */
export function rankHelpTopics(
  topics: HelpTopic[],
  pathname: string,
  query = '',
): HelpTopic[] {
  const filtered = topics.filter((t) => topicMatchesQuery(t, query))
  const contextual = filtered.filter((t) => topicMatchesPath(t, pathname))
  const general = filtered.filter((t) => !topicMatchesPath(t, pathname))
  return [...contextual, ...general]
}

export function findHelpTopic(pack: HelpPack, topicId: string): HelpTopic | undefined {
  return pack.topics.find((t) => t.id === topicId)
}
