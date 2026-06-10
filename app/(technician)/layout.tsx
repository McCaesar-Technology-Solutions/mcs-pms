import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { TechnicianShell } from '@/components/technician/technician-shell'

export default async function TechnicianLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'technician') {
    redirect('/login')
  }

  return <TechnicianShell profile={profile}>{children}</TechnicianShell>
}
