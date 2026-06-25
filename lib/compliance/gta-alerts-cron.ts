import { createAdminClient } from '@/lib/supabase/admin'
import { assessGtaLicense, gtaAlertIdempotencyKey } from '@/lib/compliance/gta-license'
import { enqueueEmailOutbox, enqueueSmsOutbox } from '@/lib/notifications/outbox'
import { getAppOrigin } from '@/lib/env'

export async function processGtaLicenseAlerts(): Promise<{ alerted: number }> {
  const admin = createAdminClient()
  const { data: hotels } = await admin
    .from('hotels')
    .select('id, name, gta_license_number, gta_license_expiry, owner_id')
    .not('owner_id', 'is', null)

  if (!hotels?.length) return { alerted: 0 }

  let alerted = 0
  const appOrigin = getAppOrigin()

  for (const hotel of hotels) {
    const check = assessGtaLicense({
      licenseNumber: hotel.gta_license_number,
      expiryDate: hotel.gta_license_expiry,
    })

    if (check.status === 'valid' || check.status === 'missing') continue

    const tier =
      check.status === 'expired'
        ? 'expired'
        : check.status === 'expiring_critical'
          ? 'critical'
          : 'soon'

    const idempotencyKey = gtaAlertIdempotencyKey(
      hotel.id,
      check.expiryDate ?? 'unknown',
      tier,
    )

    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('phone, name')
      .eq('id', hotel.owner_id!)
      .maybeSingle()

    const body = `[${hotel.name}] ${check.message} Update license in Settings → GRA compliance.`

    if (ownerProfile?.phone) {
      await enqueueSmsOutbox({
        hotelId: hotel.id,
        phone: ownerProfile.phone,
        body,
        templateKey: 'gta_license_expiry',
        idempotencyKey: `${idempotencyKey}:sms`,
      })
      alerted++
    }

    const { data: ownerAuth } = await admin.auth.admin.getUserById(hotel.owner_id!)
    const ownerEmail = ownerAuth.user?.email
    if (ownerEmail) {
      await enqueueEmailOutbox({
        hotelId: hotel.id,
        email: ownerEmail,
        templateKey: 'gta_license_expiry',
        idempotencyKey: `${idempotencyKey}:email`,
        content: {
          subject: `GTA license alert — ${hotel.name}`,
          preview: check.message ?? 'GTA license renewal required',
          lines: [check.message ?? 'Your GTA license needs attention.'],
          actionUrl: `${appOrigin}/owner/settings`,
          actionLabel: 'Open settings',
        },
      })
      alerted++
    }
  }

  return { alerted }
}
