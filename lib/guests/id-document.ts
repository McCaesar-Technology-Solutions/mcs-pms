import { z } from 'zod'
import { parseGhanaCard } from '@/lib/billing/ghana-card'

export const GUEST_ID_DOCUMENT_TYPES = ['ghana_card', 'passport', 'drivers_license'] as const
export type GuestIdDocumentType = (typeof GUEST_ID_DOCUMENT_TYPES)[number]

export const GUEST_ID_DOCUMENT_LABEL: Record<GuestIdDocumentType, string> = {
  ghana_card: 'Ghana Card',
  passport: 'Passport',
  drivers_license: "Driver's licence",
}

/** Common issuing countries for a Ghana property. */
export const GUEST_ID_COUNTRIES: { code: string; name: string }[] = [
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'CI', name: 'Côte d’Ivoire' },
  { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'ML', name: 'Mali' },
  { code: 'SN', name: 'Senegal' },
  { code: 'LR', name: 'Liberia' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'CA', name: 'Canada' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'AU', name: 'Australia' },
]

export interface GuestIdDocument {
  type: GuestIdDocumentType | null
  number: string | null
  country: string | null
}

export const EMPTY_GUEST_ID_DOCUMENT: GuestIdDocument = {
  type: null,
  number: null,
  country: null,
}

const PASSPORT_RE = /^[A-Z0-9]{6,12}$/
const LICENCE_RE = /^[A-Z0-9-]{5,20}$/
const COUNTRY_RE = /^[A-Z]{2}$/

function normalizeCountry(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const code = raw.trim().toUpperCase()
  if (!code) return null
  return COUNTRY_RE.test(code) ? code : null
}

function normalizePassport(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '')
}

function normalizeLicence(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function parseGuestIdDocument(input: {
  type?: string | null
  number?: string | null
  country?: string | null
}): { ok: true; value: GuestIdDocument } | { ok: false; error: string } {
  const typeRaw = (input.type ?? '').trim()
  const numberRaw = input.number ?? ''
  const countryRaw = input.country ?? ''

  const type =
    typeRaw === '' || typeRaw === 'none'
      ? null
      : (GUEST_ID_DOCUMENT_TYPES as readonly string[]).includes(typeRaw)
        ? (typeRaw as GuestIdDocumentType)
        : null

  if (typeRaw && !type && typeRaw !== 'none') {
    return { ok: false, error: 'Choose Ghana Card, passport, or driver’s licence.' }
  }

  const hasNumber = numberRaw.trim().length > 0
  if (!type && !hasNumber && !countryRaw.trim()) {
    return { ok: true, value: EMPTY_GUEST_ID_DOCUMENT }
  }
  if (!type && hasNumber) {
    return { ok: false, error: 'Select an ID type.' }
  }
  if (type && !hasNumber) {
    return { ok: false, error: `Enter the ${GUEST_ID_DOCUMENT_LABEL[type]} number.` }
  }

  if (type === 'ghana_card') {
    const card = parseGhanaCard(numberRaw)
    if (!card.ok) return card
    return {
      ok: true,
      value: { type: 'ghana_card', number: card.value, country: 'GH' },
    }
  }

  if (type === 'passport') {
    const number = normalizePassport(numberRaw)
    if (!PASSPORT_RE.test(number)) {
      return { ok: false, error: 'Passport number should be 6–12 letters or digits.' }
    }
    const country = normalizeCountry(countryRaw)
    if (countryRaw.trim() && !country) {
      return { ok: false, error: 'Issuing country must be a 2-letter code (e.g. GB).' }
    }
    return { ok: true, value: { type: 'passport', number, country } }
  }

  const number = normalizeLicence(numberRaw)
  if (!LICENCE_RE.test(number)) {
    return { ok: false, error: 'Licence number should be 5–20 letters, digits, or hyphens.' }
  }
  const country = normalizeCountry(countryRaw)
  if (countryRaw.trim() && !country) {
    return { ok: false, error: 'Issuing country must be a 2-letter code (e.g. GH).' }
  }
  return { ok: true, value: { type: 'drivers_license', number, country } }
}

export function guestIdDocumentFromRow(row: {
  id_document_type?: string | null
  id_document_number?: string | null
  id_document_country?: string | null
  ghana_card_number?: string | null
}): GuestIdDocument {
  const typeRaw = row.id_document_type ?? null
  const number = row.id_document_number?.trim() || null
  if (typeRaw && number && (GUEST_ID_DOCUMENT_TYPES as readonly string[]).includes(typeRaw)) {
    const type = typeRaw as GuestIdDocumentType
    return {
      type,
      number,
      country:
        row.id_document_country?.trim().toUpperCase() || (type === 'ghana_card' ? 'GH' : null),
    }
  }
  if (row.ghana_card_number?.trim()) {
    return {
      type: 'ghana_card',
      number: row.ghana_card_number.trim(),
      country: 'GH',
    }
  }
  return EMPTY_GUEST_ID_DOCUMENT
}

/** Persist ID plus dual-write ghana_card_number for older readers. */
export function guestIdDocumentColumns(doc: GuestIdDocument) {
  return {
    id_document_type: doc.type,
    id_document_number: doc.number,
    id_document_country: doc.country,
    ghana_card_number: doc.type === 'ghana_card' ? doc.number : null,
  }
}

export function guestIdDocumentHasValue(doc: GuestIdDocument): boolean {
  return Boolean(doc.type && doc.number)
}

export function formatGuestIdDocument(doc: GuestIdDocument): string {
  if (!doc.type || !doc.number) return 'No ID on file'
  const label = GUEST_ID_DOCUMENT_LABEL[doc.type]
  const country = doc.country && doc.type !== 'ghana_card' ? ` (${doc.country})` : ''
  return `${label}${country} · ${doc.number}`
}

export const guestIdDocumentFieldShape = {
  idDocumentType: z
    .enum(['ghana_card', 'passport', 'drivers_license'])
    .nullable()
    .optional(),
  idDocumentNumber: z.string().optional().or(z.literal('')),
  idDocumentCountry: z.string().max(8).optional().or(z.literal('')),
}

export type GuestIdDocumentFormFields = {
  idDocumentType?: GuestIdDocumentType | null
  idDocumentNumber?: string
  idDocumentCountry?: string
}

export function parseGuestIdDocumentFields(
  data: GuestIdDocumentFormFields,
): { ok: true; value: GuestIdDocument } | { ok: false; error: string } {
  return parseGuestIdDocument({
    type: data.idDocumentType,
    number: data.idDocumentNumber,
    country: data.idDocumentCountry,
  })
}
