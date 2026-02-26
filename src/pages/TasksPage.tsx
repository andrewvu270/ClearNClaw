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
import { DurationPicker } from '../components/DurationPicker'
import { breakDownTask } from '../services/agentService'
import * as taskService from '../services/taskService'
import { getActiveTasks, getDoneTasks } from '../utils/filters'
import { calculateProgress } from '../utils/progress'
import { energyTagToCoins } from '../utils/energyTag'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import type { BigTask } from '../types'

type Tab = 'active' | 'done'

export function TasksPage() {
  const [tasks, setTasks] = useState<BigTask[]>([])
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [focusedTask, setFocusedTask] = useState<BigTask | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [restoredFocus, setRestoredFocus] = useState(false)

  // Persist focused task ID across navigation
  const setFocusedTaskAndPersist = useCallback((task: BigTask | null) => {
    setFocusedTask(task)
    if (task) {
      sessionStorage.setItem('focusedTaskId', task.id)
    } else {
      sessionStorage.removeItem('focusedTaskId')
    }
  }, [])

  // Restore focused task from sessionStorage after tasks load
  useEffect(() => {
    if (!dataLoaded || restoredFocus) return
    setRestoredFocus(true)
    const savedId = sessionStorage.getItem('focusedTaskId')
    if (savedId) {
      const found = tasks.find(t => t.id === savedId)
      if (found) setFocusedTask(found)
      else sessionStorage.removeItem('focusedTaskId')
    }
  }, [dataLoaded, tasks, restoredFocus])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

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
    setDataLoaded(true)
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
      const { emoji, subTasks, energyTag } = await breakDownTask(description)
      await taskService.createBigTask(userId, description, emoji, subTasks, energyTag)
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

  const handleEditSubTaskEmoji = async (subTaskId: string, emoji: string) => {
    await taskService.updateSubTaskEmoji(subTaskId, emoji)
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

  const handleEditEmoji = async (taskId: string, emoji: string) => {
    await taskService.updateBigTaskEmoji(taskId, emoji)
    await fetchTasks()
  }

  const handleDelete = async (taskId: string) => {
    await taskService.deleteBigTask(taskId)
    setFocusedTaskAndPersist(null)
    await fetchTasks()
  }

  const displayed = tab === 'active' ? getActiveTasks(tasks) : getDoneTasks(tasks)

  return (
    <div className="h-screen bg-base-900 flex flex-col relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none">
        <DotGrid dotSize={6} gap={20} baseColor="#271E37" activeColor="#5227FF" proximity={150} shockRadius={250} shockStrength={4} returnDuration={1.0} />
      </div>
      {/* Fixed header */}
      <div className="shrink-0 max-w-lg mx-auto w-full px-4 pt-6 relative z-10">
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
      <div className="flex-1 min-h-0 relative z-10">
        <div className="h-full">
          <AnimatePresence>
            {dataLoaded ? (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
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
                  // Progress-based gradient tint
                  const gradientBg = progress < 0.3
                    ? 'bg-gradient-to-br from-neon-pink/5 to-transparent'
                    : progress < 0.7
                      ? 'bg-gradient-to-br from-neon-yellow/5 to-transparent'
                      : 'bg-gradient-to-br from-neon-cyan/5 to-transparent'
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
                        className={`py-8 px-6 cursor-pointer relative group ${gradientBg}`}
                        spotlightColor="rgba(0, 229, 255, 0.12)"
                        onClick={() => setFocusedTaskAndPersist(task)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                          className="absolute top-1 right-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-600 hover:text-neon-pink transition-colors"
                          aria-label="Delete task"
                        >
                          ×
                        </button>
                        {/* Coin reward preview on active cards */}
                        {!task.completed && (
                          <div className="absolute top-1 left-3 h-[36px] flex items-center gap-1 opacity-60">
                            <span className="text-sm">🪙</span>
                            <span className="text-neon-yellow font-pixel text-[9px]">+{energyTagToCoins(task.energyTag)}</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center">
                          <p className="text-white font-body text-lg mb-1">{task.name}</p>
                          <p className="text-gray-500 text-xs mb-6">{doneCount}/{task.subTasks.length} done</p>
                          <CircularProgressEmoji emoji={task.emoji} progress={progress} size={150} />
                        </div>
                      </SpotlightCard>
                    </motion.div>
                  )
                })}
              </div>
            )}
              </motion.div>
            ) : (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center pt-16"
              >
                <span className="text-gray-600 text-xs animate-pulse">Loading...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Focus view overlay */}
      <AnimatePresence>
        {focusedTask && (
          <FocusView
            task={focusedTask}
            readOnly={focusedTask.completed}
            onClose={() => setFocusedTaskAndPersist(null)}
            onEditName={handleEditName}
            onEditEmoji={handleEditEmoji}
            onToggleSubTask={handleToggleSubTask}
            onEditSubTaskName={handleEditSubTaskName}
            onEditSubTaskEmoji={handleEditSubTaskEmoji}
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
              <p className="text-gray-400 text-xs mb-6">Complete this task and earn {focusedTask ? energyTagToCoins(focusedTask.energyTag) : 1} coin{focusedTask && energyTagToCoins(focusedTask.energyTag) > 1 ? 's' : ''}?</p>
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
  onEditEmoji,
  onToggleSubTask,
  onEditSubTaskName,
  onEditSubTaskEmoji,
  onDeleteSubTask,
  onAddSubTask,
}: {
  task: BigTask
  readOnly?: boolean
  onClose: () => void
  onEditName: (id: string, name: string) => void
  onEditEmoji: (id: string, emoji: string) => void
  onToggleSubTask: (id: string, completed: boolean) => void
  onEditSubTaskName: (id: string, name: string) => void
  onEditSubTaskEmoji: (id: string, emoji: string) => void
  onDeleteSubTask: (id: string) => void
  onAddSubTask: (bigTaskId: string, name: string) => void
}) {
  const doneCount = task.subTasks.filter(st => st.completed).length
  const timer = useFocusTimer()
  
  const [showDurationPicker, setShowDurationPicker] = useState(false)

  // Calculate display progress: circle fills as timer counts down (inverted)
  // When timer starts, circle is empty (0). As time passes, circle fills up.
  // When timer reaches 0, circle is full (1).
  // When paused, keep the progress frozen
  const displayProgress = (timer.isRunning || timer.isPaused) && timer.totalSeconds > 0
    ? 1 - (timer.remainingSeconds / timer.totalSeconds)
    : 0

  // Handle timer expiry - just stop, no prompts
  useEffect(() => {
    if (timer.remainingSeconds === 0 && timer.isRunning) {
      timer.stop()
    }
  }, [timer.remainingSeconds, timer.isRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pause timer when task is completed
  useEffect(() => {
    if (task.completed && timer.isRunning) {
      timer.pause()
    }
  }, [task.completed, timer.isRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartTimer = () => {
    setShowDurationPicker(true)
  }

  const handleConfirmDuration = (durationMs: number) => {
    // Stop any existing timer and start fresh
    timer.stop()
    timer.start(durationMs, false)
    setShowDurationPicker(false)
  }

  const handlePauseTimer = () => {
    timer.pause()
  }

  const handleResumeTimer = () => {
    timer.resume()
  }

  const handleResetTimer = () => {
    // Just open the picker, don't stop the current timer yet
    // Timer will only be stopped when user confirms a new duration
    setShowDurationPicker(true)
  }

  const handleCancelPicker = () => {
    // Just close the picker, keep existing timer state
    setShowDurationPicker(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-base-900"
    >
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <Aurora colorStops={['#00e5ff', '#064e3b', '#ff1493']} amplitude={1.2} speed={0.8} blend={0.6} />
      </div>

      {/* Duration Picker Modal */}
      {showDurationPicker && (
        <DurationPicker
          onConfirm={handleConfirmDuration}
          onCancel={handleCancelPicker}
        />
      )}

      {/* Fixed header with back button */}
      <div className="relative z-10 shrink-0 px-4 pt-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={onClose}
            className="min-w-[52px] min-h-[52px] flex items-center justify-center text-gray-400 hover:text-white transition-colors text-2xl"
            aria-label="Back"
          >
            ←
          </button>
        </div>
      </div>

      {/* Fixed task name and emoji section */}
      <div className="relative z-10 shrink-0 px-4 pt-4">
        <div className="max-w-lg mx-auto">
          {/* Editable name */}
          <div className="text-center mb-2">
            {readOnly ? (
              <p className="text-white font-body text-2xl">{task.name}</p>
            ) : (
              <EditableTaskName
                name={task.name}
                onSave={(name) => onEditName(task.id, name)}
              />
            )}
          </div>

          <p className="text-gray-400 text-xs text-center mb-6">
            {doneCount}/{task.subTasks.length} done
          </p>

          {/* Big emoji + progress ring */}
          <div className="flex flex-col items-center mb-4">
            {readOnly ? (
              <CircularProgressEmoji emoji={task.emoji} progress={displayProgress} size={225} />
            ) : (
              <EditableBigEmoji
                emoji={task.emoji}
                progress={displayProgress}
                onSave={(emoji) => onEditEmoji(task.id, emoji)}
              />
            )}
            
            {/* Timer countdown text and controls - only show for active tasks */}
            {!readOnly && (timer.isRunning || timer.isPaused) ? (
              <div className="flex flex-col items-center gap-3 mt-4">
                <div className="text-3xl font-mono text-neon-cyan">
                  {String(Math.floor(timer.remainingSeconds / 60)).padStart(2, '0')}:
                  {String(timer.remainingSeconds % 60).padStart(2, '0')}
                </div>
                <div className="flex items-center gap-3">
                  {timer.isRunning ? (
                    <button
                      onClick={handlePauseTimer}
                      className="w-12 h-12 flex items-center justify-center bg-base-700 text-gray-300 rounded-full hover:bg-base-600 transition-colors text-xl"
                      aria-label="Pause timer"
                    >
                      ⏸
                    </button>
                  ) : (
                    <button
                      onClick={handleResumeTimer}
                      className="w-12 h-12 flex items-center justify-center bg-neon-cyan/20 text-neon-cyan border border-neon-cyan rounded-full hover:bg-neon-cyan/30 transition-colors text-xl"
                      aria-label="Resume timer"
                    >
                      ▶
                    </button>
                  )}
                  <button
                    onClick={handleResetTimer}
                    className="w-12 h-12 flex items-center justify-center bg-base-700 text-gray-300 rounded-full hover:bg-base-600 transition-colors text-xl"
                    aria-label="Reset timer"
                  >
                    ↻
                  </button>
                </div>
              </div>
            ) : !readOnly && (
              <button
                onClick={handleStartTimer}
                className="mt-4 px-6 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan rounded-full hover:bg-neon-cyan/30 transition-colors text-sm"
              >
                Start Timer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable sub-tasks area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-lg mx-auto">
          <div className="space-y-1 pl-4">
            {task.subTasks.map(st => (
              <SubTaskItem
                key={st.id}
                subTask={st}
                onToggle={onToggleSubTask}
                onEditName={onEditSubTaskName}
                onEditEmoji={onEditSubTaskEmoji}
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
    <div className="flex items-center gap-3 mt-4 pl-4">
      <div className="w-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add a sub-task..."
          className="w-full bg-transparent text-white text-base px-0 py-2 border-b border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600"
        />
      </div>
      <div className="w-10 shrink-0" />
      <button
        onClick={handleAdd}
        className="w-8 h-10 flex items-center justify-center text-gray-500 hover:text-neon-cyan transition-colors text-lg leading-none shrink-0"
        aria-label="Add sub-task"
      >
        +
      </button>
    </div>
  )
}

// ── Editable big task emoji ──
function EditableBigEmoji({ emoji, progress, onSave }: { emoji: string; progress: number; onSave: (emoji: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(emoji)

  useEffect(() => { setValue(emoji) }, [emoji])

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== emoji) onSave(trimmed)
    else setValue(emoji)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-3">
        <CircularProgressEmoji emoji={value || emoji} progress={progress} size={225} />
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setValue(emoji); setEditing(false) } }}
          className="w-20 text-center text-2xl bg-base-800 rounded-xl border border-neon-cyan/30 outline-none focus:border-neon-cyan py-1"
          maxLength={4}
          autoFocus
        />
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="active:scale-95 transition-transform">
      <CircularProgressEmoji emoji={emoji} progress={progress} size={225} />
    </button>
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
        className="w-full bg-transparent text-white text-2xl text-center px-1 py-1 border-b border-neon-cyan/30 outline-none focus:border-neon-cyan font-body"
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-white font-body text-2xl hover:text-neon-cyan transition-colors cursor-text"
    >
      {name}
    </button>
  )
}
