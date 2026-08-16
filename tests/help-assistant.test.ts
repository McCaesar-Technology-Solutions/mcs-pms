import { describe, expect, it } from 'vitest'
import { getHelpPack, rankHelpTopics } from '@/lib/help'

describe('help assistant', () => {
  it('returns role-specific packs', () => {
    expect(getHelpPack('receptionist').topics.length).toBeGreaterThan(3)
    expect(getHelpPack('owner').title).toContain('Owner')
  })

  it('prioritizes topics for the current path', () => {
    const pack = getHelpPack('receptionist')
    const ranked = rankHelpTopics(pack.topics, '/receptionist/reservations')
    const ids = ranked.slice(0, 4).map((t) => t.id)
    expect(ids).toContain('checkout')
    expect(ids).not.toContain('nav')
  })

  it('filters topics by search query', () => {
    const pack = getHelpPack('receptionist')
    const ranked = rankHelpTopics(pack.topics, '/', 'walkout')
    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.id).toBe('walkout')
  })

  it('surfaces dispute hold for desk roles', () => {
    expect(rankHelpTopics(getHelpPack('receptionist').topics, '/', 'dispute')[0]?.id).toBe(
      'dispute-hold',
    )
    expect(rankHelpTopics(getHelpPack('manager').topics, '/', 'dispute')[0]?.id).toBe('dispute-hold')
    expect(rankHelpTopics(getHelpPack('owner').topics, '/', 'dispute')[0]?.id).toBe('dispute-hold')
  })
})
