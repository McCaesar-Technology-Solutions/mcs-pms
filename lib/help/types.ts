import type { UserRole } from '@/types'

export type HelpRole = UserRole | 'guest'

export interface HelpTopic {
  id: string
  title: string
  summary: string
  steps: string[]
  href?: string
  hrefLabel?: string
  keywords: string[]
  /** Boost when pathname starts with any of these prefixes */
  pathPrefixes?: string[]
}

export interface HelpPack {
  role: HelpRole
  title: string
  subtitle: string
  topics: HelpTopic[]
}
