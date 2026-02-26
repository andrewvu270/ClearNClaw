import type { BigTask } from '../types'

interface CompactTaskCardProps {
  task: BigTask
  onCardClick: (task: BigTask) => void
  onSettingsClick: (task: BigTask) => void
}

export function CompactTaskCard({ task, onCardClick, onSettingsClick }: CompactTaskCardProps) {
  const completedCount = task.subTasks.filter(st => st.completed).length
  const totalCount = task.subTasks.length
  const isDone = task.completed || completedCount === totalCount

  return (
    <div className="flex items-center gap-2 group min-h-[48px]">
      {/* Emoji with background circle */}
      <button
        onClick={() => onCardClick(task)}
        className="w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-colors hover:brightness-110 active:scale-95"
        style={{ backgroundColor: 'rgba(255, 182, 216, 0.68)' }}
        aria-label="View task details"
      >
        <span className="text-xl select-none leading-none">{task.emoji}</span>
      </button>

      {/* Task name */}
      <button
        onClick={() => onCardClick(task)}
        className="flex-1 min-w-0 text-left"
        aria-label="View task details"
      >
        <span className={`text-base break-words ${
          isDone ? 'text-gray-500 line-through' : 'text-gray-200'
        }`}>
          {task.name}
        </span>
      </button>

      {/* Progress count — fixed position next to info icon */}
      <span className="text-xs text-gray-500 shrink-0 tabular-nums mr-1">
        {completedCount}/{totalCount}
      </span>

      {/* Settings (info) icon */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSettingsClick(task)
        }}
        className="w-6 h-6 flex items-center justify-center shrink-0 text-gray-400 hover:text-neon-cyan transition-colors"
        aria-label="Task settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
    </div>
  )
}
