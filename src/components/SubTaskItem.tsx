import { useState } from 'react'
import type { SubTask } from '../types'

interface SubTaskItemProps {
  subTask: SubTask
  onToggle: (subTaskId: string, completed: boolean) => void
  onEditName: (subTaskId: string, name: string) => void
  onDelete: (subTaskId: string) => void
}

export function SubTaskItem({ subTask, onToggle, onEditName, onDelete }: SubTaskItemProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(subTask.name)

  const handleSave = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== subTask.name) {
      onEditName(subTask.id, trimmed)
    } else {
      setEditValue(subTask.name)
    }
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={() => onToggle(subTask.id, !subTask.completed)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={subTask.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          subTask.completed
            ? 'bg-neon-green/20 border-neon-green text-neon-green'
            : 'border-gray-500 hover:border-neon-cyan'
        }`}>
          {subTask.completed && <span className="text-xs">✓</span>}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            className="w-full bg-base-900 text-white text-xs px-2 py-1 rounded border border-neon-cyan/30 outline-none focus:border-neon-cyan"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={`text-xs text-left truncate w-full ${
              subTask.completed ? 'text-gray-500 line-through' : 'text-gray-200'
            }`}
          >
            {subTask.name}
          </button>
        )}
      </div>

      <button
        onClick={() => onDelete(subTask.id)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 opacity-0 group-hover:opacity-100 hover:text-neon-pink transition-all"
        aria-label="Delete sub-task"
      >
        ×
      </button>
    </div>
  )
}
