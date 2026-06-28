import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { getStaffContacts } from '@/lib/data/contacts'
import { createAdminClient } from '@/lib/supabase/admin'
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
    const admin = createAdminClient()
    const [contacts, { data: hotel }] = await Promise.all([
      getStaffContacts(profile.hotel_id, ['manager']),
      admin.from('hotels').select('name, profile_image_path').eq('id', profile.hotel_id).maybeSingle(),
    ])
    managerContacts = contacts
    propertyName = hotel?.name ?? propertyName
    propertyImageUrl = propertyImagePublicUrl(hotel?.profile_image_path)
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
