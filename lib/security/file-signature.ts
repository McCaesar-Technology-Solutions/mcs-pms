/**
 * Server-side file type validation by magic bytes. Never trust the
 * client-supplied File.type / extension — spoof it and you can smuggle
 * arbitrary content (e.g. HTML/SVG with a script payload) into a bucket
 * labeled as an image.
 */

export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

const SIGNATURES: Array<{ type: SniffedType; check: (buf: Buffer) => boolean }> = [
  {
    type: 'image/jpeg',
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    type: 'image/png',
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    type: 'image/webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    type: 'application/pdf',
    check: (buf) => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-',
  },
]

/** Returns the sniffed type from actual bytes, or null if it doesn't match any allowed signature. */
export function sniffFileType(buffer: Buffer): SniffedType | null {
  for (const sig of SIGNATURES) {
    if (sig.check(buffer)) return sig.type
  }
  return null
}

/**
 * Validate a buffer against an allow-list of accepted types by content, not
 * by client-supplied MIME. Returns the confirmed type or null if it doesn't
 * match anything in `allowed`.
 */
export function validateFileSignature(
  buffer: Buffer,
  allowed: SniffedType[],
): SniffedType | null {
  const sniffed = sniffFileType(buffer)
  if (!sniffed) return null
  return allowed.includes(sniffed) ? sniffed : null
}
