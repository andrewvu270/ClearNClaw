import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CircularProgressEmoji } from './CircularProgressEmoji'
import { SubTaskItem } from './SubTaskItem'
import { calculateProgress } from '../utils/progress'
import type { BigTask } from '../types'

interface TaskCardProps {
  task: BigTask
  onEditName: (taskId: string, name: string) => void
  onDelete: (taskId: string) => void
  onToggleSubTask: (subTaskId: string, completed: boolean) => void
  onEditSubTaskName: (subTaskId: string, name: string) => void
  onDeleteSubTask: (subTaskId: string) => void
  onAddSubTask: (bigTaskId: string, name: string) => void
}

export function TaskCard({
  task,
  onEditName,
  onDelete,
  onToggleSubTask,
  onEditSubTaskName,
  onDeleteSubTask,
  onAddSubTask,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.name)
  const [newSubTask, setNewSubTask] = useState('')

  const progress = calculateProgress(task.subTasks)
  const doneCount = task.subTasks.filter(st => st.completed).length
  const totalCount = task.subTasks.length

  const handleSaveName = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== task.name) {
      onEditName(task.id, trimmed)
    } else {
      setEditValue(task.name)
    }
    setEditing(false)
  }

  const handleAddSubTask = () => {
    const trimmed = newSubTask.trim()
    if (trimmed) {
      onAddSubTask(task.id, trimmed)
      setNewSubTask('')
    }
  }

  return (
    <div className="bg-base-800 rounded-2xl border border-base-700 overflow-hidden shadow-lg shadow-black/20">
      {/* Hero section — big emoji + progress ring */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
        className="flex flex-col items-center pt-5 pb-4 px-4 cursor-pointer hover:bg-base-700/30 transition-colors"
        aria-expanded={expanded}
      >
        {/* Task name + actions */}
        <div className="w-full flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            {editing ? (
              <input
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                onClick={e => e.stopPropagation()}
                className="w-full bg-base-900 text-white text-sm px-2 py-1 rounded border border-neon-cyan/30 outline-none focus:border-neon-cyan"
                autoFocus
              />
            ) : (
              <p className={`font-body text-sm ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                {task.name}
              </p>
            )}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setEditing(true) }}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-500 hover:text-neon-cyan transition-colors text-sm"
              aria-label="Edit task name"
            >
              ✏️
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-500 hover:text-neon-pink transition-colors text-sm"
              aria-label="Delete task"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Big circular progress + emoji */}
        <CircularProgressEmoji emoji={task.emoji} progress={progress} size={120} />

        {/* Progress text */}
        <p className="text-gray-400 text-xs font-body mt-3">
          {doneCount}/{totalCount} done
        </p>
      </div>

      {/* Sub-tasks list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-base-700">
              <div className="mt-3 space-y-1">
                {task.subTasks.map(st => (
                  <SubTaskItem
                    key={st.id}
                    subTask={st}
                    onToggle={onToggleSubTask}
                    onEditName={onEditSubTaskName}
                    onDelete={onDeleteSubTask}
                  />
                ))}
              </div>
              {/* Add sub-task */}
              <div className="flex gap-2 mt-3">
                <input
                  value={newSubTask}
                  onChange={e => setNewSubTask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubTask() }}
                  placeholder="Add a sub-task..."
                  className="flex-1 bg-base-900 text-white text-xs px-3 py-2 rounded-lg border border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600"
                />
                <button
                  onClick={handleAddSubTask}
                  className="min-w-[44px] min-h-[44px] bg-neon-cyan/20 text-neon-cyan text-xs font-pixel rounded-lg hover:bg-neon-cyan/30 transition-colors"
                  aria-label="Add sub-task"
                >
                  +
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
