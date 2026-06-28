import type { SupabaseClient } from '@supabase/supabase-js'
import { computeInvoiceTaxes, type InvoiceTaxes, type VatMode } from '@/lib/tax'

export interface UnbilledFolioCharge {
  id: string
  amount: number
  description: string
  charge_type: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Folio incidentals are taxed exclusive and merged with room checkout taxes. */
export function mergeRoomTaxesWithFolio(
  roomTaxes: InvoiceTaxes,
  folioSubtotal: number,
  includeTax = true,
): InvoiceTaxes {
  if (folioSubtotal <= 0) return roomTaxes

  if (!includeTax) {
    const subtotal = round2(roomTaxes.subtotal + folioSubtotal)
    return {
      subtotal,
      nhil: 0,
      getfund: 0,
      covid: 0,
      vat: 0,
      elevy: 0,
      total: subtotal,
    }
  }

  const folioTaxes = computeInvoiceTaxes(folioSubtotal, 'exclusive')
  return {
    subtotal: round2(roomTaxes.subtotal + folioTaxes.subtotal),
    nhil: round2(roomTaxes.nhil + folioTaxes.nhil),
    getfund: round2(roomTaxes.getfund + folioTaxes.getfund),
    covid: round2(roomTaxes.covid + folioTaxes.covid),
    vat: round2(roomTaxes.vat + folioTaxes.vat),
    elevy: round2(roomTaxes.elevy + folioTaxes.elevy),
    total: round2(roomTaxes.total + folioTaxes.total),
  }
}

export async function loadUnbilledFolioCharges(
  admin: SupabaseClient,
  hotelId: string,
  guestId: string,
  reservationId?: string | null,
): Promise<UnbilledFolioCharge[]> {
  let query = admin
    .from('guest_charges')
    .select('id, amount, description, charge_type')
    .eq('hotel_id', hotelId)
    .eq('guest_id', guestId)
    .is('invoice_id', null)
    .order('created_at', { ascending: true })

  if (reservationId) {
    query = query.or(`reservation_id.eq.${reservationId},reservation_id.is.null`)
  }

  const { data } = await query
  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    description: row.description,
    charge_type: row.charge_type,
  }))
}

export function sumFolioSubtotal(charges: UnbilledFolioCharge[]): number {
  return round2(charges.reduce((sum, c) => sum + c.amount, 0))
}

export async function linkFolioChargesToInvoice(
  admin: SupabaseClient,
  chargeIds: string[],
  invoiceId: string,
): Promise<void> {
  if (!chargeIds.length) return
  await admin.from('guest_charges').update({ invoice_id: invoiceId }).in('id', chargeIds)
}

export async function prepareCheckoutTaxesWithFolio(
  admin: SupabaseClient,
  hotelId: string,
  guestId: string,
  reservationId: string | null | undefined,
  roomTaxes: InvoiceTaxes,
  includeTax = true,
): Promise<{
  taxes: InvoiceTaxes
  folioCharges: UnbilledFolioCharge[]
  folioSubtotal: number
}> {
  const folioCharges = await loadUnbilledFolioCharges(admin, hotelId, guestId, reservationId)
  const folioSubtotal = sumFolioSubtotal(folioCharges)
  const taxes = mergeRoomTaxesWithFolio(roomTaxes, folioSubtotal, includeTax)
  return { taxes, folioCharges, folioSubtotal }
}
