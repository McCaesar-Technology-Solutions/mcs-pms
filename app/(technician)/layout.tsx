import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { getStaffContacts } from '@/lib/data/contacts'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { propertyImagePublicUrl } from '@/lib/properties/image-storage'
import { TechnicianShell } from '@/components/technician/technician-shell'

export default async function TechnicianLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'technician') {
    redirect('/login')
  }

  let managerContacts: Awaited<ReturnType<typeof getStaffContacts>> = []
  let propertyName = 'MOJO Apartments'
  let propertyImageUrl: string | null = null

  if (profile.hotel_id) {
    try {
      const admin = tryCreateAdminClient()
      const [contacts, hotelResult] = await Promise.all([
        getStaffContacts(profile.hotel_id, ['manager']),
        admin
          ? admin.from('hotels').select('name, profile_image_path').eq('id', profile.hotel_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      managerContacts = contacts
      propertyName = hotelResult.data?.name ?? propertyName
      propertyImageUrl = propertyImagePublicUrl(hotelResult.data?.profile_image_path)
    } catch (err) {
      console.error('[technician layout] property load failed:', err)
    }
  }

  return (
    <TechnicianShell
      profile={profile}
      managerContacts={managerContacts}
      propertyName={propertyName}
      propertyImageUrl={propertyImageUrl}
    >
      {children}
    </TechnicianShell>
  )
}
