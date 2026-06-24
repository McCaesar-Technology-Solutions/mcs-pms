import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEntityType =
  | 'reservation'
  | 'room'
  | 'room_category'
  | 'hotel'
  | 'staff'
  | 'guest'
  | 'invoice'
  | 'complaint'
  | 'guest_request'

export interface AuditLogInput {
  hotelId: string
  actorId: string
  actorName?: string | null
  entityType: AuditEntityType
  entityId?: string | null
  action: string
  summary: string
  details?: Record<string, unknown> | null
}

/** Non-blocking audit write — failures are swallowed so ops actions still succeed. */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({
      hotel_id: input.hotelId,
      actor_id: input.actorId,
      actor_name: input.actorName?.trim() || null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      summary: input.summary,
      details: (input.details ?? null) as import('@/lib/supabase/types').Json | null,
    })
  } catch {
    // audit should never block primary workflows
  }
}

/** Room grid + automatic status from stays (check-in, checkout, move). */
export async function logRoomStatusChange(input: {
  hotelId: string
  actorId: string
  actorName?: string | null
  roomId: string
  roomNumber: string | number
  from: string
  to: string
  reason?: string
}): Promise<void> {
  if (input.from === input.to) return
  const suffix = input.reason ? ` (${input.reason})` : ''
  await writeAuditLog({
    hotelId: input.hotelId,
    actorId: input.actorId,
    actorName: input.actorName,
    entityType: 'room',
    entityId: input.roomId,
    action: 'status_changed',
    summary: `Room ${input.roomNumber}: ${input.from} → ${input.to}${suffix}`,
  })
}

export function moneyDelta(label: string, before: number | null | undefined, after: number): string | null {
  const prev = before != null ? Number(before) : null
  if (prev === null || prev === after) return null
  return `${label}: ₵${prev.toLocaleString()} → ₵${after.toLocaleString()}`
}
