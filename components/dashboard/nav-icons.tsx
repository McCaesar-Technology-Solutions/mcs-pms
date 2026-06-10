import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Users,
  Banknote,
  FileText,
  BarChart3,
  Settings,
  Wrench,
  UserCog,
  BedDouble,
} from 'lucide-react'
import type { NavIconKey } from '@/lib/navigation'

export const navIcons: Record<NavIconKey, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  briefcase: Briefcase,
  calendar: Calendar,
  users: Users,
  banknote: Banknote,
  'file-text': FileText,
  'bar-chart-3': BarChart3,
  settings: Settings,
  wrench: Wrench,
  'user-cog': UserCog,
  'bed-double': BedDouble,
}

export function getNavIcon(key: NavIconKey): LucideIcon {
  return navIcons[key]
}
