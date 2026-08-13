import { describe, expect, it } from 'vitest'
import { amountInWordsCedis } from '@/lib/export/amount-in-words'

describe('amountInWordsCedis', () => {
  it('converts whole cedis amounts', () => {
    expect(amountInWordsCedis(11800)).toBe('Eleven Thousand Eight Hundred Cedis Only')
    expect(amountInWordsCedis(35980)).toBe(
      'Thirty Five Thousand Nine Hundred Eighty Cedis Only',
    )
    expect(amountInWordsCedis(0)).toBe('Zero Cedis Only')
    expect(amountInWordsCedis(1)).toBe('One Cedis Only')
  })

  it('includes pesewas when present', () => {
    expect(amountInWordsCedis(100.5)).toBe('One Hundred Cedis and Fifty Pesewas Only')
  })
})
