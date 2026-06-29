'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LayoutGrid, List, Smartphone } from 'lucide-react'
import { HousekeepingKanban } from '@/components/dashboard/housekeeping-kanban'
import { HousekeepingTableView } from '@/components/dashboard/housekeeping-table-view'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'

interface HousekeepingBoardProps {
  tasks: HousekeepingTaskView[]
  rooms: { id: string; number: string }[]
  staff: { id: string; name: string }[]
  canManage?: boolean
  currentUserId?: string
  mobileHref?: string
}

export function HousekeepingBoard(props: HousekeepingBoardProps) {
  const { mobileHref = '/mobile/housekeeping', ...boardProps } = props
  const [view, setView] = useState<'kanban' | 'list'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'list' : 'kanban',
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={mobileHref}
          className="rooms-view-toggle__btn md:hidden"
        >
          <Smartphone className="h-4 w-4" />
          Mobile view
        </Link>
        <div className="rooms-view-toggle" role="tablist" aria-label="Housekeeping view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'kanban'}
            className={`rooms-view-toggle__btn ${view === 'kanban' ? 'rooms-view-toggle__btn--active' : ''}`}
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
            Board
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            className={`rooms-view-toggle__btn ${view === 'list' ? 'rooms-view-toggle__btn--active' : ''}`}
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <HousekeepingKanban {...boardProps} />
      ) : (
        <HousekeepingTableView {...boardProps} />
      )}
    </div>
  )
}
