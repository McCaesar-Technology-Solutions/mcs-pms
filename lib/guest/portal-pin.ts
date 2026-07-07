import { randomInt } from 'crypto'

/** Digits in a guest portal access PIN. */
export const PORTAL_PIN_LENGTH = 4

/**
 * Generate a random numeric portal PIN (zero-padded). Combined with the room
 * number and rate limiting, this replaces the guessable "last name" factor for
 * self-service guest portal entry.
 */
export function generatePortalPin(): string {
  const max = 10 ** PORTAL_PIN_LENGTH
  return String(randomInt(0, max)).padStart(PORTAL_PIN_LENGTH, '0')
}

/** Normalize user-entered PIN input (strip spaces, keep digits). */
export function normalizePortalPin(input: string): string {
  return input.replace(/\D/g, '')
}
