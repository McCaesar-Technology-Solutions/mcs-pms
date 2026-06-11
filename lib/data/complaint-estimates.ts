import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ComplaintEstimate, ComplaintEstimateItem } from '@/types'

type EstimateRow = ComplaintEstimate & {
  complaint_estimate_items: ComplaintEstimateItem[] | null
  technician: { name: string } | null
}

function mapEstimate(row: EstimateRow): ComplaintEstimate {
  const items = (row.complaint_estimate_items ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  return {
    id: row.id,
    complaint_id: row.complaint_id,
    hotel_id: row.hotel_id,
    technician_id: row.technician_id,
    note: row.note,
    labour_cost: Number(row.labour_cost),
    materials_total: Number(row.materials_total),
    total_cost: Number(row.total_cost),
    created_at: row.created_at,
    updated_at: row.updated_at,
    items,
    technician: row.technician ? { name: row.technician.name } : null,
  }
}

const estimateSelect = `
  *,
  complaint_estimate_items (*),
  technician:profiles!technician_id (name)
`

export async function getComplaintEstimate(
  complaintId: string,
): Promise<ComplaintEstimate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('complaint_estimates')
    .select(estimateSelect)
    .eq('complaint_id', complaintId)
    .maybeSingle()

  if (error || !data) return null
  return mapEstimate(data as unknown as EstimateRow)
}

/** Batch fetch estimates for complaint list badges (manager). */
export async function getEstimatesForComplaints(
  complaintIds: string[],
): Promise<Map<string, ComplaintEstimate>> {
  if (complaintIds.length === 0) return new Map()

  const supabase = await createClient()
  const { data } = await supabase
    .from('complaint_estimates')
    .select(estimateSelect)
    .in('complaint_id', complaintIds)

  const map = new Map<string, ComplaintEstimate>()
  for (const row of data ?? []) {
    const est = mapEstimate(row as unknown as EstimateRow)
    map.set(est.complaint_id, est)
  }
  return map
}

export async function getComplaintEstimateAdmin(
  complaintId: string,
): Promise<ComplaintEstimate | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('complaint_estimates')
    .select(estimateSelect)
    .eq('complaint_id', complaintId)
    .maybeSingle()

  if (!data) return null
  return mapEstimate(data as unknown as EstimateRow)
}
