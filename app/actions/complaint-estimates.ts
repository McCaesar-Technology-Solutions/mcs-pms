'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getComplaintEstimate } from '@/lib/data/complaint-estimates'
import {
  COMPLAINT_INVOICE_BUCKET,
  INVOICE_MAX_BYTES,
  invoiceFileExtension,
  invoiceStoragePath,
  sanitizeDownloadFilename,
} from '@/lib/complaints/invoice-storage'
import { submitComplaintEstimateSchema } from '@/lib/validations'
import type { ComplaintEstimate } from '@/types'
import { runNotifyTask } from '@/lib/notifications/notify-task'

export type EstimateActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

function revalidateEstimateViews() {
  revalidatePath('/technician/tasks')
  revalidatePath('/manager/complaints')
  revalidatePath('/owner/complaints')
  revalidatePath('/receptionist/complaints')
}

async function requireAssignedTechnician(complaintId: string) {
  const result = await requireVerifiedStaff({ roles: ['technician'] })
  if (!result.ok) return { error: consumeStaffAuthError(result.error) }

  const { supabase, user, profile } = result

  const { data: complaint } = await supabase
    .from('complaints')
    .select('id, hotel_id, assigned_to, status, approval_stage')
    .eq('id', complaintId)
    .maybeSingle()

  if (!complaint || complaint.assigned_to !== user.id) {
    return { error: 'This task is not assigned to you.' as const }
  }

  if (
    !['assigned', 'in_progress', 'rejected'].includes(complaint.status ?? '') &&
    !(complaint.status === 'pending_approval' && complaint.approval_stage === 'completion')
  ) {
    return {
      error: 'You can only submit an invoice while the job is active or awaiting sign-off.',
    } as const
  }

  return {
    supabase,
    user,
    complaint,
    technicianName: profile.name ?? 'Technician',
  }
}

async function requireInvoiceViewer(complaintId: string) {
  const result = await requireVerifiedStaff({
    roles: ['owner', 'manager', 'receptionist', 'technician'],
  })
  if (!result.ok) return { error: consumeStaffAuthError(result.error) }

  const { supabase, user, profile } = result

  const { data: complaint } = await supabase
    .from('complaints')
    .select('id, hotel_id, assigned_to')
    .eq('id', complaintId)
    .maybeSingle()

  if (!complaint) return { error: 'Complaint not found.' as const }

  if (profile.role === 'technician') {
    if (complaint.assigned_to !== user.id) {
      return { error: 'Not authorized.' as const }
    }
  } else if (profile.hotel_id !== complaint.hotel_id) {
    return { error: 'Not authorized.' as const }
  }

  return { profile, complaint }
}

type MaterialRow = {
  material_name: string
  quantity: number
  unit_cost: number
  line_total: number
  sort_order: number
}

async function persistComplaintEstimate(input: {
  complaintId: string
  hotelId: string
  technicianId: string
  technicianName: string
  note: string | null
  labourCost: number
  materials: MaterialRow[]
  invoiceFilePath?: string | null
  invoiceFileName?: string | null
  invoiceFileMime?: string | null
  removeOldFilePath?: string | null
}): Promise<EstimateActionResult<ComplaintEstimate>> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const materialsTotal = input.materials.reduce((sum, m) => sum + m.line_total, 0)
  const totalCost = Math.round((materialsTotal + input.labourCost) * 100) / 100

  const { data: existing } = await admin
    .from('complaint_estimates')
    .select('id, invoice_file_path')
    .eq('complaint_id', input.complaintId)
    .maybeSingle()

  let estimateId: string

  const filePayload = {
    ...(input.invoiceFilePath !== undefined
      ? {
          invoice_file_path: input.invoiceFilePath,
          invoice_file_name: input.invoiceFileName ?? null,
          invoice_file_mime: input.invoiceFileMime ?? null,
        }
      : {}),
  }

  if (existing) {
    const { error: updateError } = await admin
      .from('complaint_estimates')
      .update({
        note: input.note,
        labour_cost: input.labourCost,
        materials_total: materialsTotal,
        total_cost: totalCost,
        updated_at: now,
        ...filePayload,
      })
      .eq('id', existing.id)

    if (updateError) return { success: false, error: updateError.message }

    await admin.from('complaint_estimate_items').delete().eq('estimate_id', existing.id)
    estimateId = existing.id

    const oldPath = input.removeOldFilePath ?? existing.invoice_file_path
    if (
      input.invoiceFilePath &&
      oldPath &&
      oldPath !== input.invoiceFilePath
    ) {
      await admin.storage.from(COMPLAINT_INVOICE_BUCKET).remove([oldPath])
    }
  } else {
    const { data: inserted, error: insertError } = await admin
      .from('complaint_estimates')
      .insert({
        complaint_id: input.complaintId,
        hotel_id: input.hotelId,
        technician_id: input.technicianId,
        note: input.note,
        labour_cost: input.labourCost,
        materials_total: materialsTotal,
        total_cost: totalCost,
        invoice_file_path: input.invoiceFilePath ?? null,
        invoice_file_name: input.invoiceFileName ?? null,
        invoice_file_mime: input.invoiceFileMime ?? null,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message ?? 'Could not save estimate.' }
    }
    estimateId = inserted.id
  }

  if (input.materials.length > 0) {
    const { error: itemsError } = await admin.from('complaint_estimate_items').insert(
      input.materials.map((m) => ({ ...m, estimate_id: estimateId })),
    )
    if (itemsError) return { success: false, error: itemsError.message }
  }

  const summaryParts: string[] = []
  if (input.invoiceFileName) {
    summaryParts.push(`Invoice file: ${input.invoiceFileName}`)
  }
  if (totalCost > 0) {
    summaryParts.push(
      `Cost estimate: ₵${totalCost.toLocaleString()} (materials ₵${materialsTotal.toLocaleString()} + labour ₵${input.labourCost.toLocaleString()})`,
    )
  }
  const summaryNote = summaryParts.join(' · ') || 'Invoice updated'

  await admin.from('complaint_events').insert({
    complaint_id: input.complaintId,
    actor_id: input.technicianId,
    actor_role: 'technician',
    event_type: 'estimate_submitted',
    note: input.note ? `${summaryNote}\n\n${input.note}` : summaryNote,
  })

  void import('@/lib/notifications/complaints').then(({ notifyComplaintInvoiceSubmitted }) =>
    runNotifyTask(
      notifyComplaintInvoiceSubmitted(input.complaintId, totalCost, input.technicianName),
      { templateKey: 'complaint_invoice_submitted' },
    ),
  )

  revalidateEstimateViews()

  const estimate = await getComplaintEstimate(input.complaintId)
  if (!estimate) return { success: false, error: 'Estimate saved but could not reload.' }

  return { success: true, data: estimate }
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

  const ctx = await requireAssignedTechnician(parsed.data.complaintId)
  if ('error' in ctx) return { success: false, error: ctx.error ?? 'Not authorized.' }

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

  const labourCost = Math.round(parsed.data.labourCost * 100) / 100
  const materialsTotal = materials.reduce((sum, m) => sum + m.line_total, 0)
  if (materialsTotal + labourCost <= 0) {
    return {
      success: false,
      error: 'Add labour, materials, or upload an invoice file.',
    }
  }

  return persistComplaintEstimate({
    complaintId: parsed.data.complaintId,
    hotelId: ctx.complaint.hotel_id,
    technicianId: ctx.user.id,
    technicianName: ctx.technicianName,
    note: parsed.data.note?.trim() || null,
    labourCost,
    materials,
  })
}

/** Manual line items + optional invoice file upload (PDF or image). */
export async function submitComplaintEstimateWithFile(
  formData: FormData,
): Promise<EstimateActionResult<ComplaintEstimate>> {
  const complaintId = String(formData.get('complaintId') ?? '')
  const note = String(formData.get('note') ?? '')
  const labourCost = Number(formData.get('labourCost') ?? 0)
  const materialsRaw = String(formData.get('materials') ?? '[]')
  const fileEntry = formData.get('invoiceFile')

  let materialsInput: { materialName: string; quantity: number; unitCost: number }[] = []
  try {
    materialsInput = JSON.parse(materialsRaw)
  } catch {
    return { success: false, error: 'Invalid materials data.' }
  }

  const parsed = submitComplaintEstimateSchema.safeParse({
    complaintId,
    note,
    labourCost,
    materials: materialsInput,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid estimate.' }
  }

  const ctx = await requireAssignedTechnician(parsed.data.complaintId)
  if ('error' in ctx) return { success: false, error: ctx.error ?? 'Not authorized.' }

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

  const labour = Math.round(parsed.data.labourCost * 100) / 100
  const materialsTotal = materials.reduce((sum, m) => sum + m.line_total, 0)
  const hasManualTotal = materialsTotal + labour > 0

  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
  if (!hasManualTotal && !file) {
    return {
      success: false,
      error: 'Add labour, materials, or upload an invoice file.',
    }
  }

  let invoiceFilePath: string | null | undefined
  let invoiceFileName: string | null | undefined
  let invoiceFileMime: string | null | undefined
  let removeOldFilePath: string | null = null

  if (file) {
    if (file.size > INVOICE_MAX_BYTES) {
      return { success: false, error: 'Invoice file must be 10 MB or smaller.' }
    }

    const ext = invoiceFileExtension(file.type)
    if (!ext) {
      return { success: false, error: 'Upload a PDF or image (JPEG, PNG, WebP).' }
    }

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('complaint_estimates')
      .select('invoice_file_path')
      .eq('complaint_id', parsed.data.complaintId)
      .maybeSingle()

    removeOldFilePath = existing?.invoice_file_path ?? null
    const path = invoiceStoragePath(ctx.complaint.hotel_id, parsed.data.complaintId, ext)
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(COMPLAINT_INVOICE_BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message ?? 'Could not upload invoice file.' }
    }

    invoiceFilePath = path
    invoiceFileName = sanitizeDownloadFilename(file.name)
    invoiceFileMime = file.type
  }

  return persistComplaintEstimate({
    complaintId: parsed.data.complaintId,
    hotelId: ctx.complaint.hotel_id,
    technicianId: ctx.user.id,
    technicianName: ctx.technicianName,
    note: parsed.data.note?.trim() || null,
    labourCost: labour,
    materials,
    ...(file
      ? {
          invoiceFilePath,
          invoiceFileName,
          invoiceFileMime,
          removeOldFilePath,
        }
      : {}),
  })
}

export async function getComplaintInvoiceDownloadUrl(
  complaintId: string,
): Promise<EstimateActionResult<{ url: string; fileName: string }>> {
  const ctx = await requireInvoiceViewer(complaintId)
  if ('error' in ctx) return { success: false, error: ctx.error ?? 'Not authorized.' }

  const estimate = await getComplaintEstimate(complaintId)
  if (!estimate?.invoice_file_path) {
    return { success: false, error: 'No invoice file for this job.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(COMPLAINT_INVOICE_BUCKET)
    .createSignedUrl(estimate.invoice_file_path, 60 * 60)

  if (error || !data?.signedUrl) {
    return { success: false, error: 'Could not generate download link.' }
  }

  return {
    success: true,
    data: {
      url: data.signedUrl,
      fileName: estimate.invoice_file_name ?? 'invoice',
    },
  }
}
