'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Upload, Mic, CheckCircle2, AlertCircle } from 'lucide-react'

// Mock data for easy Supabase wiring later
const mockData = {
  staff: {
    name: 'Adjoa',
    role: 'Housekeeping Staff',
  },
  today: new Date('2026-06-06'),
  tasks: [
    {
      id: 1,
      roomName: 'Suite A',
      taskType: 'Clean',
      taskColor: 'purple',
      priority: 'Urgent',
      priorityColor: 'coral',
      triggeredBy: 'Checkout — Ama Owusu, due by 2pm',
      status: 'todo',
      managerNote: 'Guest checking in at 3pm. Ensure extra towels and welcome note placed on bed.',
      expanded: true,
    },
    {
      id: 2,
      roomName: 'Room 101',
      taskType: 'Inspect',
      taskColor: 'blue',
      priority: 'Normal',
      priorityColor: 'gray',
      triggeredBy: 'Pre-arrival check — Kwame Mensah, Jun 7',
      status: 'todo',
      managerNote: null,
      expanded: false,
    },
    {
      id: 3,
      roomName: 'Room 103',
      taskType: 'Restock',
      taskColor: 'purple',
      priority: 'Normal',
      priorityColor: 'gray',
      triggeredBy: 'Scheduled restock',
      status: 'in-progress',
      managerNote: null,
      expanded: false,
    },
    {
      id: 4,
      roomName: 'Suite B',
      taskType: 'Clean',
      taskColor: 'purple',
      priority: 'Urgent',
      priorityColor: 'coral',
      triggeredBy: 'Guest request — reported 08:42am',
      status: 'todo',
      managerNote: null,
      expanded: false,
    },
  ],
}

const taskBadgeColors: Record<string, string> = {
  purple: 'bg-[#4c1d95] text-white',
  gold: 'bg-[#D4A62E] text-[#22124C]',
  blue: 'bg-blue-500 text-white',
}

const priorityBadgeColors: Record<string, string> = {
  coral: 'bg-[#D85A30] text-white',
  gray: 'bg-gray-300 text-gray-700',
}

const buttonColors: Record<string, string> = {
  'Mark in progress': 'bg-amber-400 text-gray-900 hover:bg-amber-500',
  'Mark done': 'bg-[#4c1d95] text-white hover:bg-[#4c1d95]',
}

export default function MobileHousekeepingPage() {
  const [tasks, setTasks] = useState(mockData.tasks)
  const [activeTab, setActiveTab] = useState('tasks')

  const toggleExpand = (id: number) => {
    setTasks(tasks.map(t => (t.id === id ? { ...t, expanded: !t.expanded } : t)))
  }

  const updateTaskStatus = (id: number) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        if (t.status === 'todo') {
          return { ...t, status: 'in-progress' }
        } else if (t.status === 'in-progress') {
          return { ...t, status: 'done' }
        }
      }
      return t
    }))
  }

  const getButtonLabel = (status: string) => {
    if (status === 'todo') return 'Mark in progress'
    if (status === 'in-progress') return 'Mark done'
    return 'Done'
  }

  const completedCount = tasks.filter(t => t.status === 'done').length

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex min-h-dvh flex-col bg-white">
        <div className="flex-1 overflow-y-auto pb-20">
          {/* Header Section */}
          <div className="px-5 pt-6 pb-4 bg-white">
            <h1 className="text-2xl font-bold text-gray-900">Good morning, Adjoa</h1>
            <p className="text-gray-600 text-base mt-1">{dateFormatter.format(mockData.today)}</p>
            <p className="text-gray-500 text-sm mt-2">{tasks.length} tasks assigned</p>

            {/* Progress Bar */}
            <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#4c1d95] h-full transition-all duration-300"
                style={{ width: `${(completedCount / tasks.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {completedCount} of {tasks.length} complete
            </p>
          </div>

          {/* Task Cards */}
          <div className="px-4 pb-4 space-y-3">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                className={`rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 ${
                  task.status === 'done' ? 'bg-gray-50 opacity-60' : 'bg-white'
                }`}
                style={{
                  borderLeftWidth: task.priority === 'Urgent' ? '4px' : '1px',
                  borderLeftColor: task.priority === 'Urgent' ? '#D85A30' : '#e5e7eb',
                }}
              >
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{task.roomName}</h3>
                        {task.status === 'done' && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${taskBadgeColors[task.taskColor]}`}>
                          {task.taskType}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${priorityBadgeColors[task.priorityColor]}`}>
                          {task.priority}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600">{task.triggeredBy}</p>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => toggleExpand(task.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {task.expanded ? (
                        <ChevronUp className="w-6 h-6" />
                      ) : (
                        <ChevronDown className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Button */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => updateTaskStatus(task.id)}
                    disabled={task.status === 'done'}
                    className={`w-full py-3 rounded-lg font-bold text-base transition-colors ${
                      task.status === 'done'
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : task.status === 'todo'
                          ? 'bg-amber-400 text-gray-900 hover:bg-amber-500'
                          : 'bg-[#3C216C] text-white hover:bg-[#2D215B]'
                    }`}
                  >
                    {getButtonLabel(task.status)}
                  </button>
                </div>

                {/* Expanded Content */}
                {task.expanded && task.status !== 'done' && (
                  <div className="bg-gray-50 px-4 py-4 border-t border-gray-200 space-y-4">
                    {task.managerNote && (
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-[#4c1d95] flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">Manager Note</p>
                          <p className="text-sm text-gray-700">{task.managerNote}</p>
                        </div>
                      </div>
                    )}

                    {/* Photo Upload Button */}
                    <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:border-gray-400 transition-colors">
                      <Upload className="w-5 h-5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Upload photo proof</span>
                    </button>

                    {/* Voice Note Button */}
                    <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:border-gray-400 transition-colors">
                      <Mic className="w-5 h-5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Record voice note</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 flex h-16 items-center justify-around border-t border-gray-300 bg-white">
          {[
            { id: 'tasks', icon: '🧹', label: 'Tasks' },
            { id: 'rooms', icon: '🚪', label: 'Rooms' },
            { id: 'messages', icon: '💬', label: 'Messages', badge: '2' },
            { id: 'profile', icon: '👤', label: 'Profile' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors ${
                activeTab === tab.id ? 'text-[#4c1d95]' : 'text-gray-500'
              }`}
              style={{
                borderTop: activeTab === tab.id ? '3px solid #4c1d95' : 'none',
                paddingTop: activeTab === tab.id ? '8px' : '11px',
              }}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
              {tab.badge && (
                <div className="absolute top-0 right-6 w-5 h-5 bg-[#D85A30] text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </div>
              )}
            </button>
          ))}
        </div>
    </div>
  )
}
