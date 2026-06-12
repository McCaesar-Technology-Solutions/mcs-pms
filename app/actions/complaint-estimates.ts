'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getComplaintEstimate } from '@/lib/data/complaint-estimates'
import { submitComplaintEstimateSchema } from '@/lib/validations'
import type { ComplaintEstimate } from '@/types'

export type EstimateActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

function revalidateEstimateViews() {
  revalidatePath('/technician/tasks')
  revalidatePath('/manager/complaints')
}

export async function fetchComplaintEstimate(
  complaintId: string,
): Promise<EstimateActionResult<ComplaintEstimate | null>> {
  const estimate = await getComplaintEstimate(complaintId)
  return { success: true, data: estimate }
}

export async function submitComplaintEstimate(input: {
  complaintId: string
  note?: string
  labourCost: number
  materials: { materialName: string; quantity: number; unitCost: number }[]
}): Promise<EstimateActionResult<ComplaintEstimate>> {
  const parsed = submitComplaintEstimateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid estimate.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'technician') {
    return { success: false, error: 'Only technicians can submit estimates.' }
  }

  const { data: complaint } = await supabase
    .from('complaints')
    .select('id, hotel_id, assigned_to, status')
    .eq('id', parsed.data.complaintId)
    .maybeSingle()

  if (!complaint || complaint.assigned_to !== user.id) {
    return { success: false, error: 'This task is not assigned to you.' }
  }

  if (!['assigned', 'rejected'].includes(complaint.status ?? '')) {
    return {
      success: false,
      error: 'Submit your invoice while the job is assigned and before work begins.',
    }
  }

  const { data: technicianProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const materials = parsed.data.materials.map((m, i) => {
    const lineTotal = Math.round(m.quantity * m.unitCost * 100) / 100
    return {
      material_name: m.materialName.trim(),
      quantity: m.quantity,
      unit_cost: m.unitCost,
      line_total: lineTotal,
      sort_order: i,
    }
  })

  const materialsTotal = materials.reduce((sum, m) => sum + m.line_total, 0)
  const labourCost = Math.round(parsed.data.labourCost * 100) / 100
  const totalCost = Math.round((materialsTotal + labourCost) * 100) / 100

  const admin = createAdminClient()
  const note = parsed.data.note?.trim() || null
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('complaint_estimates')
    .select('id')
    .eq('complaint_id', parsed.data.complaintId)
    .maybeSingle()

  let estimateId: string

  if (existing) {
    const { error: updateError } = await admin
      .from('complaint_estimates')
      .update({
        note,
        labour_cost: labourCost,
        materials_total: materialsTotal,
        total_cost: totalCost,
        updated_at: now,
      })
      .eq('id', existing.id)

    if (updateError) return { success: false, error: updateError.message }

    await admin.from('complaint_estimate_items').delete().eq('estimate_id', existing.id)
    estimateId = existing.id
  } else {
    const { data: inserted, error: insertError } = await admin
      .from('complaint_estimates')
      .insert({
        complaint_id: parsed.data.complaintId,
        hotel_id: complaint.hotel_id,
        technician_id: user.id,
        note,
        labour_cost: labourCost,
        materials_total: materialsTotal,
        total_cost: totalCost,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message ?? 'Could not save estimate.' }
    }
    estimateId = inserted.id
  }

  if (materials.length > 0) {
    const { error: itemsError } = await admin.from('complaint_estimate_items').insert(
      materials.map((m) => ({ ...m, estimate_id: estimateId })),
    )
    if (itemsError) return { success: false, error: itemsError.message }
  }

  const summaryNote = `Cost estimate: ₵${totalCost.toLocaleString()} (materials ₵${materialsTotal.toLocaleString()} + labour ₵${labourCost.toLocaleString()})`

  await admin.from('complaint_events').insert({
    complaint_id: parsed.data.complaintId,
    actor_id: user.id,
    actor_role: 'technician',
    event_type: 'estimate_submitted',
    note: note ? `${summaryNote}\n\n${note}` : summaryNote,
  })

  await admin
    .from('complaints')
    .update({
      status: 'pending_approval',
      approval_stage: 'estimate',
      rejection_note: null,
    })
    .eq('id', parsed.data.complaintId)

  void import('@/lib/notifications/complaints').then(({ notifyComplaintInvoiceSubmitted }) =>
    notifyComplaintInvoiceSubmitted(
      parsed.data.complaintId,
      totalCost,
      technicianProfile?.name ?? undefined,
    ).catch(() => undefined),
  )

  revalidateEstimateViews()

  const estimate = await getComplaintEstimate(parsed.data.complaintId)
  if (!estimate) return { success: false, error: 'Estimate saved but could not reload.' }

  return { success: true, data: estimate }
}
