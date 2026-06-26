import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Users,
  Banknote,
  FileText,
  BarChart3,
  Globe,
  Settings,
  Wrench,
  UserCog,
  BedDouble,
  MessageCircle,
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
  globe: Globe,
  settings: Settings,
  wrench: Wrench,
  'user-cog': UserCog,
  'bed-double': BedDouble,
  'message-circle': MessageCircle,
}

export function getNavIcon(key: NavIconKey): LucideIcon {
  return navIcons[key]
}
