import { createClient } from '@/lib/supabase/server'
import type { Complaint } from '@/types'

export async function fetchHotelComplaints(): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('complaints')
    .select('*, rooms(number), guests(name, phone), assignee:profiles!complaints_assigned_to_fkey(id, name, phone, specialty)')
    .order('submitted_at', { ascending: false })

  if (error) return []
  return (data ?? []) as unknown as Complaint[]
}
