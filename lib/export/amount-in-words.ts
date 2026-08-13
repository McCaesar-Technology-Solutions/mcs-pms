/** Convert a money amount to English words for Ghana Cedis invoices. */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function underThousand(n: number): string {
  if (n <= 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) {
    const ten = Math.floor(n / 10)
    const one = n % 10
    return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten]
  }
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  return rest ? `${ONES[hundred]} Hundred ${underThousand(rest)}` : `${ONES[hundred]} Hundred`
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 1000) return underThousand(n)

  const billion = Math.floor(n / 1_000_000_000)
  const million = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousand = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000

  const parts: string[] = []
  if (billion) parts.push(`${underThousand(billion)} Billion`)
  if (million) parts.push(`${underThousand(million)} Million`)
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`)
  if (rest) parts.push(underThousand(rest))
  return parts.join(' ')
}

/**
 * e.g. 11800 → "Eleven Thousand Eight Hundred Cedis Only"
 * e.g. 11800.50 → "Eleven Thousand Eight Hundred Cedis and Fifty Pesewas Only"
 */
export function amountInWordsCedis(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const rounded = Math.round(safe * 100) / 100
  const cedis = Math.floor(rounded)
  const pesewas = Math.round((rounded - cedis) * 100)

  // Match invoice letter style: always “Cedis” / “Pesewas”.
  const cedisPart = `${integerToWords(cedis)} Cedis`
  if (pesewas <= 0) {
    return `${cedisPart} Only`
  }
  const pesewaPart = `${integerToWords(pesewas)} Pesewas`
  return `${cedisPart} and ${pesewaPart} Only`
}
