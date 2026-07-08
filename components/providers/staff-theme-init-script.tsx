import { STAFF_THEME_INIT_SCRIPT } from '@/lib/theme/staff-theme'

export function StaffThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: STAFF_THEME_INIT_SCRIPT,
      }}
    />
  )
}
