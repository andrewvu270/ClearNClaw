import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BigTask } from '../types'
import { CompactTaskCard } from './CompactTaskCard'

interface TaskGroupSectionProps {
  title: string
  emoji: string
  tasks: BigTask[]
  onCardClick: (task: BigTask) => void
  onSettingsClick: (task: BigTask) => void
}

const COLLAPSED_GROUPS_KEY = 'collapsedTaskGroups'

function getCollapsedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveCollapsedGroups(groups: Set<string>) {
  localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...groups]))
}

export function TaskGroupSection({
  title,
  emoji,
  tasks,
  onCardClick,
  onSettingsClick,
}: TaskGroupSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => getCollapsedGroups().has(title))

  // Sync with localStorage when title changes
  useEffect(() => {
    setIsCollapsed(getCollapsedGroups().has(title))
  }, [title])

  if (tasks.length === 0) {
    return null
  }

  const toggleCollapse = () => {
    const collapsed = getCollapsedGroups()
    if (isCollapsed) {
      collapsed.delete(title)
    } else {
      collapsed.add(title)
    }
    saveCollapsedGroups(collapsed)
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="mb-6">
      {/* Section header */}
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between mb-3 px-1 group"
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <h2 className="text-lg font-medium text-gray-200">{title}</h2>
          <span className="text-xs text-gray-500">({tasks.length})</span>
        </div>
        <span
          className={`text-gray-500 transition-transform duration-200 ${
            isCollapsed ? '-rotate-90' : 'rotate-0'
          }`}
        >
          ▼
        </span>
      </button>

      {/* Task list with animation */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {tasks.map(task => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  onCardClick={onCardClick}
                  onSettingsClick={onSettingsClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
