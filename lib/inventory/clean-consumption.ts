/** Suggested consumables when completing a checkout clean (qty per room turnover). */
export const DEFAULT_CLEAN_CONSUMPTION: { nameMatch: string; quantity: number }[] = [
  { nameMatch: 'towel', quantity: 2 },
  { nameMatch: 'soap', quantity: 1 },
  { nameMatch: 'shampoo', quantity: 1 },
  { nameMatch: 'toilet paper', quantity: 1 },
  { nameMatch: 'tissue', quantity: 1 },
]

export function suggestCleanConsumption(
  items: { id: string; name: string }[],
): { itemId: string; name: string; quantity: number }[] {
  const suggestions: { itemId: string; name: string; quantity: number }[] = []
  for (const preset of DEFAULT_CLEAN_CONSUMPTION) {
    const item = items.find((i) => i.name.toLowerCase().includes(preset.nameMatch))
    if (item) {
      suggestions.push({ itemId: item.id, name: item.name, quantity: preset.quantity })
    }
  }
  return suggestions
}
