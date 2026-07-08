import { MobileStaffShell } from '@/components/mobile/mobile-staff-shell'

export default function MobileLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <MobileStaffShell>{children}</MobileStaffShell>
}
