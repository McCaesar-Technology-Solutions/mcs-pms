import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'

export interface AuditLogEntry {
  id: string
  actorName: string | null
  entityType: string
  entityId: string | null
  action: string
  summary: string
  details: Record<string, unknown> | null
  createdAt: string
}

export async function getAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []
  if (!['owner', 'manager'].includes(profile.role)) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('hotel_id', profile.hotel_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    actorName: row.actor_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    details: (row.details as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }))
}
