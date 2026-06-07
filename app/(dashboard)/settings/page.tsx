import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { PageHeader } from '@/components/dashboard/page-header'

export default function SettingsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Configuration"
        title="Settings"
        description="Manage property information, team members, notifications, and integrations."
      />

      <SettingsPanel />
    </div>
  )
}
