'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Wrench } from 'lucide-react'
import { WayfindingTip } from '@/components/dashboard/wayfinding-tip'
import { TechnicianTasks } from '@/components/technician/technician-tasks'
import { TechnicianHousekeeping } from '@/components/technician/technician-housekeeping'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'

type WorkTab = 'maintenance' | 'housekeeping'

interface TechnicianWorkspaceProps {
  assignedTasks: HousekeepingTaskView[]
  unassignedTasks: HousekeepingTaskView[]
}

export function TechnicianWorkspace({
  assignedTasks,
  unassignedTasks,
}: TechnicianWorkspaceProps) {
  const [tab, setTab] = useState<WorkTab>('maintenance')
  const [jobDetailOpen, setJobDetailOpen] = useState(false)
  const searchParams = useSearchParams()
  const taskSearch = searchParams.get('q') ?? ''
  const openJobId = searchParams.get('open') ?? undefined

  const housekeepingOpenCount = useMemo(() => {
    const assignedOpen = assignedTasks.filter((t) => t.status !== 'done').length
    return assignedOpen + unassignedTasks.length
  }, [assignedTasks, unassignedTasks])

  const hasHousekeeping = housekeepingOpenCount > 0

  return (
    <div className={`technician-workspace ${jobDetailOpen ? 'technician-workspace--job-open' : ''}`}>
      {!jobDetailOpen && (
        <WayfindingTip id="nav-basics" role="technician" title="Getting around">
          Use the bottom bar to switch between <strong className="font-semibold text-foreground">Tasks</strong> and{' '}
          <strong className="font-semibold text-foreground">Messages</strong>. Press{' '}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd> to search jobs by room
          or category.
        </WayfindingTip>
      )}
      {!jobDetailOpen && (
      <div className="technician-workspace__tabs" role="tablist" aria-label="Work type">
        <button
          type="button"
          role="tab"
          id="technician-work-tab-maintenance"
          aria-selected={tab === 'maintenance'}
          aria-controls="technician-work-panel-maintenance"
          tabIndex={tab === 'maintenance' ? 0 : -1}
          onClick={() => setTab('maintenance')}
          className={`technician-workspace__tab ${
            tab === 'maintenance' ? 'technician-workspace__tab--active' : ''
          }`}
        >
          <Wrench className="h-4 w-4" aria-hidden />
          Maintenance
        </button>
        <button
          type="button"
          role="tab"
          id="technician-work-tab-housekeeping"
          aria-selected={tab === 'housekeeping'}
          aria-controls="technician-work-panel-housekeeping"
          tabIndex={tab === 'housekeeping' ? 0 : -1}
          onClick={() => setTab('housekeeping')}
          className={`technician-workspace__tab ${
            tab === 'housekeeping' ? 'technician-workspace__tab--active' : ''
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Housekeeping
          {hasHousekeeping && (
            <span className="technician-workspace__tab-badge">{housekeepingOpenCount}</span>
          )}
        </button>
      </div>
      )}

      {tab === 'maintenance' && (
        <div
          role="tabpanel"
          id="technician-work-panel-maintenance"
          aria-labelledby="technician-work-tab-maintenance"
        >
          <TechnicianTasks onJobDetailOpen={setJobDetailOpen} searchQuery={taskSearch} openJobId={openJobId} />
        </div>
      )}

      {tab === 'housekeeping' && !jobDetailOpen && (
        <div
          role="tabpanel"
          id="technician-work-panel-housekeeping"
          aria-labelledby="technician-work-tab-housekeeping"
        >
          <TechnicianHousekeeping
            assignedTasks={assignedTasks}
            unassignedTasks={unassignedTasks}
          />
        </div>
      )}
    </div>
  )
}
