import { createClient } from '@/lib/supabase/server'
import type { Complaint } from '@/types'

import { clampLimit } from '@/lib/data/pagination'

export async function fetchHotelComplaints(limit?: number): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('complaints')
    .select('*, rooms(number), guests(name, phone), assignee:profiles!complaints_assigned_to_fkey(id, name, phone, specialty)')
    .order('submitted_at', { ascending: false })
    .limit(clampLimit(limit))

  if (error) return []
  return (data ?? []) as unknown as Complaint[]
}
