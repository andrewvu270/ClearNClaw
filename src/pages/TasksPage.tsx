import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { TaskInputForm } from '../components/TaskInputForm'
import { EmptyState } from '../components/EmptyState'
import { BottomNavBar } from '../components/BottomNavBar'
import { SpotlightCard } from '../components/SpotlightCard'
import { CircularProgressEmoji } from '../components/CircularProgressEmoji'
import { SubTaskItem } from '../components/SubTaskItem'
import { Aurora } from '../components/Aurora'
import { breakDownTask } from '../services/agentService'
import * as taskService from '../services/taskService'
import { getActiveTasks, getDoneTasks } from '../utils/filters'
import { calculateProgress } from '../utils/progress'
import type { BigTask } from '../types'

type Tab = 'active' | 'done'

export function TasksPage() {
  const [tasks, setTasks] = useState<BigTask[]>([])
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [focusedTask, setFocusedTask] = useState<BigTask | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id)
    })
  }, [])

  const fetchTasks = useCallback(async () => {
    if (!userId) return
    const [active, done] = await Promise.all([
      taskService.getBigTasks(userId, false),
      taskService.getBigTasks(userId, true),
    ])
    const all = [...active, ...done]
    setTasks(all)
    // Update focused task if it's still around
    if (focusedTask) {
      const updated = all.find(t => t.id === focusedTask.id)
      if (updated) setFocusedTask(updated)
      else setFocusedTask(null)
    }
  }, [userId, focusedTask?.id])

  useEffect(() => { fetchTasks() }, [userId])

  const handleSubmit = async (description: string) => {
    if (!userId) return
    setLoading(true)
    try {
      const { emoji, subTasks } = await breakDownTask(description)
      await taskService.createBigTask(userId, description, emoji, subTasks)
      await fetchTasks()
    } catch {
      // Agent timeout or error
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSubTask = async (subTaskId: string, completed: boolean) => {
    if (!userId) return
    await taskService.toggleSubTask(subTaskId, completed, userId)
    await fetchTasks()
  }

  const handleEditSubTaskName = async (subTaskId: string, name: string) => {
    await taskService.updateSubTaskName(subTaskId, name)
    await fetchTasks()
  }

  const handleDeleteSubTask = async (subTaskId: string) => {
    await taskService.deleteSubTask(subTaskId)
    await fetchTasks()
  }

  const handleAddSubTask = async (bigTaskId: string, name: string) => {
    await taskService.addSubTask(bigTaskId, name)
    await fetchTasks()
  }

  const handleEditName = async (taskId: string, name: string) => {
    await taskService.updateBigTaskName(taskId, name)
    await fetchTasks()
  }

  const handleDelete = async (taskId: string) => {
    await taskService.deleteBigTask(taskId)
    setFocusedTask(null)
    await fetchTasks()
  }

  const displayed = tab === 'active' ? getActiveTasks(tasks) : getDoneTasks(tasks)

  // ── Focus View (full screen single task) ──
  if (focusedTask) {
    const progress = calculateProgress(focusedTask.subTasks)
    const doneCount = focusedTask.subTasks.filter(st => st.completed).length

    return (
      <div className="min-h-screen bg-base-900 relative overflow-hidden">
        {/* Aurora background */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <Aurora
            colorStops={['#00e5ff', '#39ff14', '#ff1493']}
            amplitude={1.2}
            blend={0.6}
            speed={0.8}
          />
        </div>

        <div className="relative z-10 max-w-lg mx-auto px-4 pt-6 pb-24 min-h-screen flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setFocusedTask(null)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              aria-label="Back to task list"
            >
              ← Back
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const name = prompt('Edit task name:', focusedTask.name)
                  if (name?.trim()) handleEditName(focusedTask.id, name.trim())
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-neon-cyan transition-colors text-sm"
                aria-label="Edit task name"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(focusedTask.id)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-neon-pink transition-colors text-sm"
                aria-label="Delete task"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Task name */}
          <h2 className="text-white font-body text-lg text-center mb-2">
            {focusedTask.name}
          </h2>
          <p className="text-gray-500 text-xs text-center mb-6">
            {doneCount}/{focusedTask.subTasks.length} done
          </p>

          {/* Big emoji + progress */}
          <div className="flex justify-center mb-8">
            <SpotlightCard className="p-6 inline-flex" spotlightColor="rgba(0, 229, 255, 0.12)">
              <CircularProgressEmoji
                emoji={focusedTask.emoji}
                progress={progress}
                size={160}
              />
            </SpotlightCard>
          </div>

          {/* Sub-tasks */}
          <div className="flex-1 space-y-1">
            {focusedTask.subTasks.map(st => (
              <SubTaskItem
                key={st.id}
                subTask={st}
                onToggle={handleToggleSubTask}
                onEditName={handleEditSubTaskName}
                onDelete={handleDeleteSubTask}
              />
            ))}
          </div>

          {/* Add sub-task */}
          <AddSubTaskInput onAdd={(name) => handleAddSubTask(focusedTask.id, name)} />
        </div>

        <BottomNavBar />
      </div>
    )
  }

  // ── List View ──
  return (
    <div className="min-h-screen bg-base-900 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-neon-cyan text-xs text-center mb-6 font-pixel">ADHD Task Breaker</h1>

        <TaskInputForm onSubmit={handleSubmit} loading={loading} />

        {/* Tabs */}
        <div className="flex gap-2 mt-6 mb-4">
          {(['active', 'done'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 min-h-[44px] font-pixel text-xs rounded-xl border transition-colors ${
                tab === t
                  ? 'bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan'
                  : 'bg-base-800 border-base-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {t === 'active' ? 'Active' : 'Done'}
            </button>
          ))}
        </div>

        {/* Task list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {displayed.length === 0 ? (
              tab === 'active' ? (
                <EmptyState
                  emoji="🚀"
                  message="No active tasks yet. Type in a big task above and let's break it down!"
                />
              ) : (
                <EmptyState
                  emoji="🏆"
                  message="No completed tasks yet. Finish your sub-tasks to earn coins!"
                />
              )
            ) : (
              displayed.map(task => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  onTap={() => setFocusedTask(task)}
                />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNavBar />
    </div>
  )
}


// ── Compact card for list view ──
function CompactTaskCard({ task, onTap }: { task: BigTask; onTap: () => void }) {
  const progress = calculateProgress(task.subTasks)
  const doneCount = task.subTasks.filter(st => st.completed).length

  return (
    <SpotlightCard
      className="cursor-pointer"
      spotlightColor="rgba(0, 229, 255, 0.1)"
    >
      <button
        onClick={onTap}
        className="w-full flex items-center gap-4 p-4 min-h-[44px] text-left"
      >
        <CircularProgressEmoji emoji={task.emoji} progress={progress} size={52} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-body truncate ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
            {task.name}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {doneCount}/{task.subTasks.length} done
          </p>
        </div>
        <span className="text-gray-600 text-sm">›</span>
      </button>
    </SpotlightCard>
  )
}

// ── Inline add sub-task input ──
function AddSubTaskInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState('')

  const handleAdd = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
    }
  }

  return (
    <div className="flex gap-2 mt-4">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        placeholder="Add a sub-task..."
        className="flex-1 bg-base-800 text-white text-xs px-3 py-2 rounded-lg border border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600"
      />
      <button
        onClick={handleAdd}
        className="min-w-[44px] min-h-[44px] bg-neon-cyan/20 text-neon-cyan text-xs font-pixel rounded-lg hover:bg-neon-cyan/30 transition-colors"
        aria-label="Add sub-task"
      >
        +
      </button>
    </div>
  )
}
