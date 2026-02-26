import type { BigTask } from '../types'
import { CompactTaskCard } from './CompactTaskCard'

interface TaskGroupSectionProps {
  title: string
  emoji: string
  tasks: BigTask[]
  onCardClick: (task: BigTask) => void
  onSettingsClick: (task: BigTask) => void
}

export function TaskGroupSection({ 
  title, 
  emoji, 
  tasks, 
  onCardClick, 
  onSettingsClick 
}: TaskGroupSectionProps) {
  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-xl">{emoji}</span>
        <h2 className="text-lg font-medium text-gray-200">{title}</h2>
      </div>

      {/* Task list */}
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
    </div>
  )
}
