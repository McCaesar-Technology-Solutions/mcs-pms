'use client'

import { useState } from 'react'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
import {
  GUEST_ID_COUNTRIES,
  GUEST_ID_DOCUMENT_LABEL,
  type GuestIdDocument,
  type GuestIdDocumentFormFields,
  type GuestIdDocumentType,
} from '@/lib/guests/id-document'

export interface GuestIdDocumentFieldState {
  type: GuestIdDocumentType | ''
  number: string
  country: string
}

export function guestIdDocumentStateFromDoc(
  doc?: GuestIdDocument | null,
): GuestIdDocumentFieldState {
  return {
    type: doc?.type ?? '',
    number: doc?.number ?? '',
    country: doc?.country ?? (doc?.type === 'ghana_card' ? 'GH' : ''),
  }
}

export function guestIdDocumentPayload(
  state: GuestIdDocumentFieldState,
): GuestIdDocumentFormFields {
  return {
    idDocumentType: state.type ? state.type : null,
    idDocumentNumber: state.number,
    idDocumentCountry: state.country,
  }
}

export function useGuestIdDocumentFields(initial?: GuestIdDocument | null) {
  const [state, setState] = useState<GuestIdDocumentFieldState>(() =>
    guestIdDocumentStateFromDoc(initial),
  )
  return {
    state,
    setState,
    payload: guestIdDocumentPayload(state),
    applyDocument: (doc: GuestIdDocument | null) => setState(guestIdDocumentStateFromDoc(doc)),
  }
}

interface GuestIdDocumentFieldsProps {
  state: GuestIdDocumentFieldState
  onChange: (next: GuestIdDocumentFieldState) => void
  /** Guest edit can explicitly clear. Check-in/create omit a blank ID instead. */
  allowNone?: boolean
}

export function GuestIdDocumentFields({
  state,
  onChange,
  allowNone = true,
}: GuestIdDocumentFieldsProps) {
  const showCountry = state.type === 'passport' || state.type === 'drivers_license'
  const placeholder =
    state.type === 'ghana_card'
      ? 'GHA-728071939-8'
      : state.type === 'passport'
        ? 'Passport number'
        : state.type === 'drivers_license'
          ? 'Licence number'
          : 'Select a type first'
  const hint =
    state.type === 'ghana_card'
      ? 'Format GHA-#########-#. Stored on the guest record, not as invoice Tax ID.'
      : state.type === 'passport'
        ? '6–12 letters or digits. Issuing country optional.'
        : state.type === 'drivers_license'
          ? 'Letters, digits, or hyphens. Issuing country optional.'
          : 'Optional. Ghana Card, passport, or driver’s licence.'

  function setType(type: GuestIdDocumentType | '') {
    onChange({
      type,
      number: type === '' ? '' : state.number,
      country: type === 'ghana_card' ? 'GH' : type === '' ? '' : state.country,
    })
  }

  return (
    <div className="space-y-3">
      <FormField label="ID document (optional)" hint={hint}>
        <select
          className={APP_FIELD_CLASS}
          value={state.type}
          onChange={(e) => setType(e.target.value as GuestIdDocumentType | '')}
          aria-label="ID document type"
        >
          <option value="">{allowNone ? 'None' : 'Select type'}</option>
          {(Object.keys(GUEST_ID_DOCUMENT_LABEL) as GuestIdDocumentType[]).map((key) => (
            <option key={key} value={key}>
              {GUEST_ID_DOCUMENT_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>
      {state.type ? (
        <FormField label={`${GUEST_ID_DOCUMENT_LABEL[state.type]} number`}>
          <input
            value={state.number}
            onChange={(e) =>
              onChange({
                ...state,
                number:
                  state.type === 'ghana_card' || state.type === 'passport'
                    ? e.target.value.toUpperCase()
                    : e.target.value.toUpperCase(),
              })
            }
            placeholder={placeholder}
            className={`${APP_FIELD_CLASS} uppercase`}
            autoComplete="off"
          />
        </FormField>
      ) : null}
      {showCountry ? (
        <FormField label="Issuing country (optional)">
          <select
            className={APP_FIELD_CLASS}
            value={state.country}
            onChange={(e) => onChange({ ...state, country: e.target.value })}
            aria-label="Issuing country"
          >
            <option value="">Not specified</option>
            {GUEST_ID_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
    </div>
  )
}
