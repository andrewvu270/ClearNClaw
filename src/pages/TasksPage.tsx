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
import DotGrid from '../components/DotGrid'
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
    setTasks([...active, ...done])
  }, [userId])

  useEffect(() => { fetchTasks() }, [userId, fetchTasks])

  // Keep focusedTask in sync with latest task data
  useEffect(() => {
    if (!focusedTask) return
    const updated = tasks.find(t => t.id === focusedTask.id)
    if (updated) setFocusedTask(updated)
    else setFocusedTask(null) // task was deleted
  }, [tasks]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const [pendingComplete, setPendingComplete] = useState<string | null>(null)

  const handleToggleSubTask = async (subTaskId: string, completed: boolean) => {
    if (!userId) return

    // If checking the last incomplete subtask, show custom confirm
    if (completed && focusedTask) {
      const remaining = focusedTask.subTasks.filter(st => !st.completed && st.id !== subTaskId)
      if (remaining.length === 0) {
        setPendingComplete(subTaskId)
        return
      }
    }

    await taskService.toggleSubTask(subTaskId, completed, userId)
    await fetchTasks()
  }

  const confirmComplete = async () => {
    if (!pendingComplete || !userId) return
    await taskService.toggleSubTask(pendingComplete, true, userId)
    setPendingComplete(null)
    await fetchTasks()
  }

  const cancelComplete = () => {
    setPendingComplete(null)
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

  return (
    <div className="h-screen bg-base-900 flex flex-col relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <DotGrid dotSize={6} gap={20} baseColor="#1a3a4a" activeColor="#22d3ee" proximity={100} shockRadius={200} shockStrength={3} returnDuration={1.2} />
      </div>
      {/* Fixed header */}
      <div className="shrink-0 max-w-lg mx-auto w-full px-4 pt-6">
        <h1 className="text-neon-cyan text-xs text-center mb-6 font-pixel opacity-0 pointer-events-none">Clear</h1>
        <TaskInputForm onSubmit={handleSubmit} loading={loading} />
        <div className="relative flex gap-8 mt-6 mb-2 justify-center">
          {(['active', 'done'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative min-h-[44px] text-sm transition-colors ${
                tab === t ? 'text-neon-cyan' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'active' ? 'Active' : 'Done'}
              {tab === t && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-neon-cyan rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable task stack */}
      <div className="flex-1 min-h-0">
        <div className="h-full">
            {displayed.length === 0 ? (
              <div className="max-w-lg mx-auto px-4">
                {tab === 'active' ? (
                  <EmptyState emoji="🚀" message="No active tasks yet. Type in a big task above and let's break it down!" />
                ) : (
                  <EmptyState emoji="🏆" message="No completed tasks yet. Finish your sub-tasks to earn coins!" />
                )}
              </div>
            ) : (
              <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 overflow-y-auto h-full pb-24">
                {displayed.map(task => {
                  const progress = calculateProgress(task.subTasks)
                  const doneCount = task.subTasks.filter(st => st.completed).length
                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <SpotlightCard
                        className="py-8 px-6 cursor-pointer relative group"
                        spotlightColor="rgba(0, 229, 255, 0.12)"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                          className="absolute top-3 right-3 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-600 hover:text-neon-pink transition-colors"
                          aria-label="Delete task"
                        >
                          ×
                        </button>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setFocusedTask(task)}
                          onKeyDown={e => { if (e.key === 'Enter') setFocusedTask(task) }}
                          className="flex flex-col items-center"
                        >
                          <p className="text-white font-body text-lg mb-1">{task.name}</p>
                          <p className="text-gray-500 text-xs mb-6">{doneCount}/{task.subTasks.length} done</p>
                          <CircularProgressEmoji emoji={task.emoji} progress={progress} size={120} />
                        </div>
                      </SpotlightCard>
                    </motion.div>
                  )
                })}
              </div>
            )}
        </div>
      </div>

      {/* Focus view overlay */}
      <AnimatePresence>
        {focusedTask && (
          <FocusView
            task={focusedTask}
            readOnly={focusedTask.completed}
            onClose={() => setFocusedTask(null)}
            onEditName={handleEditName}
            onToggleSubTask={handleToggleSubTask}
            onEditSubTaskName={handleEditSubTaskName}
            onDeleteSubTask={handleDeleteSubTask}
            onAddSubTask={handleAddSubTask}
          />
        )}
      </AnimatePresence>

      {/* Completion confirm modal */}
      <AnimatePresence>
        {pendingComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-base-800 border border-base-700 rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-white font-body text-sm mb-1">All sub-tasks done!</p>
              <p className="text-gray-400 text-xs mb-6">Complete this task and earn 1 coin?</p>
              <div className="flex gap-3">
                <button
                  onClick={cancelComplete}
                  className="flex-1 min-h-[44px] text-sm text-gray-400 border border-base-700 rounded-xl hover:bg-base-700 transition-colors"
                >
                  Not yet
                </button>
                <button
                  onClick={confirmComplete}
                  className="flex-1 min-h-[44px] text-sm text-neon-cyan border border-neon-cyan/30 rounded-xl bg-neon-cyan/10 hover:bg-neon-cyan/20 transition-colors"
                >
                  Complete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNavBar />
    </div>
  )
}


// ── Full-screen focus view overlay ──
function FocusView({
  task,
  readOnly,
  onClose,
  onEditName,
  onToggleSubTask,
  onEditSubTaskName,
  onDeleteSubTask,
  onAddSubTask,
}: {
  task: BigTask
  readOnly?: boolean
  onClose: () => void
  onEditName: (id: string, name: string) => void
  onToggleSubTask: (id: string, completed: boolean) => void
  onEditSubTaskName: (id: string, name: string) => void
  onDeleteSubTask: (id: string) => void
  onAddSubTask: (bigTaskId: string, name: string) => void
}) {
  const progress = calculateProgress(task.subTasks)
  const doneCount = task.subTasks.filter(st => st.completed).length

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-base-900"
    >
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <Aurora amplitude={0.8} speed={0.4} blend={0.6} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-6 pb-2">
        <button
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <div className="min-w-[44px]" />
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-lg mx-auto">
          {/* Editable name */}
          <div className="text-center mb-2">
            {readOnly ? (
              <p className="text-white font-body text-lg">{task.name}</p>
            ) : (
              <EditableTaskName
                name={task.name}
                onSave={(name) => onEditName(task.id, name)}
              />
            )}
          </div>

          <p className="text-gray-500 text-xs text-center mb-6">
            {doneCount}/{task.subTasks.length} done
          </p>

          {/* Big emoji + progress ring */}
          <div className="flex justify-center mb-8">
            <CircularProgressEmoji emoji={task.emoji} progress={progress} size={140} />
          </div>

          {/* Sub-tasks */}
          <div className="space-y-1">
            {task.subTasks.map(st => (
              <SubTaskItem
                key={st.id}
                subTask={st}
                onToggle={onToggleSubTask}
                onEditName={onEditSubTaskName}
                onDelete={onDeleteSubTask}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Add sub-task */}
          {!readOnly && <AddSubTaskInput onAdd={(name) => onAddSubTask(task.id, name)} />}
        </div>
      </div>
    </motion.div>
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
    <div className="flex items-center gap-2 mt-4">
      <div className="min-w-[44px]" />
      <div className="flex-1 min-w-0">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add a sub-task..."
          className="w-full bg-transparent text-white text-xs px-0 py-2 border-b border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600"
        />
      </div>
      <button
        onClick={handleAdd}
        className="text-gray-500 hover:text-neon-cyan transition-colors text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Add sub-task"
      >
        +
      </button>
    </div>
  )
}

// ── Inline editable task name ──
function EditableTaskName({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  useEffect(() => { setValue(name) }, [name])

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== name) onSave(trimmed)
    else setValue(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setValue(name); setEditing(false) } }}
        className="w-full bg-transparent text-white text-lg text-center px-1 py-1 border-b border-neon-cyan/30 outline-none focus:border-neon-cyan font-body"
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-white font-body text-lg hover:text-neon-cyan transition-colors cursor-text"
    >
      {name}
    </button>
  )
}
