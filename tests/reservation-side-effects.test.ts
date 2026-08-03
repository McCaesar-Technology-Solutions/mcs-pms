import { describe, expect, it } from 'vitest'
import { partitionSideEffects } from '@/lib/reservations/side-effects'

describe('reservation side effect ordering', () => {
  it('runs hold-timer and room-status before RPC', () => {
    const effects = ['inventory', 'hold-timer', 'payment', 'room-status', 'notifications'] as const
    const { pre, post } = partitionSideEffects([...effects])
    expect(pre).toEqual(['hold-timer', 'room-status'])
    expect(post).toEqual(['inventory', 'payment', 'notifications'])
  })

  it('places charge and notification effects after RPC', () => {
    const noShow = ['inventory', 'payment', 'notifications'] as const
    const { pre, post } = partitionSideEffects([...noShow])
    expect(pre).toEqual([])
    expect(post).toEqual(['inventory', 'payment', 'notifications'])
  })
})
