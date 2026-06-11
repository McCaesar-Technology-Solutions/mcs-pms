import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { getStaffContacts } from '@/lib/data/contacts'
import { TechnicianShell } from '@/components/technician/technician-shell'

export default async function TechnicianLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'technician') {
    redirect('/login')
  }

  const managerContacts = profile.hotel_id
    ? await getStaffContacts(profile.hotel_id, ['manager', 'owner'])
    : []

  return (
    <TechnicianShell profile={profile} managerContacts={managerContacts}>
      {children}
    </TechnicianShell>
  )
}
