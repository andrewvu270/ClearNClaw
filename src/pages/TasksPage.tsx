import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TaskInputForm } from '../components/TaskInputForm'
import { EmptyState } from '../components/EmptyState'
import { BottomNavBar } from '../components/BottomNavBar'
import DotGrid from '../components/DotGrid'
import { breakDownTask } from '../services/agentService'
import * as taskService from '../services/taskService'
import { energyTagToCoins } from '../utils/energyTag'
import { groupTasks } from '../utils/taskGrouping'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import { TaskGroupSection } from '../components/TaskGroupSection'
import { TaskDetailModal } from '../components/TaskDetailModal'
import { FocusView } from '../components/FocusView'
import { Toast } from '../components/Toast'
import { checkAndResetRecurringTasks } from '../services/recurrenceService'
import type { BigTask } from '../types'

export function TasksPage() {
  const [tasks, setTasks] = useState<BigTask[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [focusedTask, setFocusedTask] = useState<BigTask | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [restoredFocus, setRestoredFocus] = useState(false)
  const [detailModalTask, setDetailModalTask] = useState<BigTask | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  const timer = useFocusTimer()
  const location = useLocation()

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

  // Open focus view when navigated from GlobalNowActiveBar with focusTaskId state
  useEffect(() => {
    if (!dataLoaded) return
    const state = location.state as { focusTaskId?: string } | null
    if (state?.focusTaskId) {
      const found = tasks.find(t => t.id === state.focusTaskId)
      if (found) {
        setFocusedTask(found)
        sessionStorage.setItem('focusedTaskId', found.id)
      }
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, '')
    }
  }, [dataLoaded, tasks, location.state])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        // Update last_session_date for push notification scheduling
        supabase
          .from('profiles')
          .update({ last_session_date: new Date().toISOString() })
          .eq('id', session.user.id)
          .then(({ error }) => {
            if (error) console.warn('Failed to update last_session_date:', error)
          })
      }
    })
  }, [])

  const fetchTasks = useCallback(async () => {
    if (!userId) return
    // Reset overdue recurring tasks before fetching
    try {
      await checkAndResetRecurringTasks(userId)
    } catch (err) {
      console.warn('Failed to reset recurring tasks:', err)
    }
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

  // Track active timer task in context (global)
  // Only set activeTask when timer starts running while a task is focused.
  // Don't overwrite activeTask just because focusedTask changed.
  const prevTimerRunning = useState({ isRunning: false, isPaused: false })[0]
  useEffect(() => {
    const wasActive = prevTimerRunning.isRunning || prevTimerRunning.isPaused
    const isActive = timer.isRunning || timer.isPaused

    // Timer just became active — set the active task to whatever is focused
    if (isActive && !wasActive && focusedTask) {
      timer.setActiveTask(focusedTask)
    }

    prevTimerRunning.isRunning = timer.isRunning
    prevTimerRunning.isPaused = timer.isPaused
  }, [timer.isRunning, timer.isPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep context activeTask in sync with latest task data
  useEffect(() => {
    if (!timer.activeTask || !dataLoaded) return
    const updated = tasks.find(t => t.id === timer.activeTask!.id)
    if (updated) timer.setActiveTask(updated)
    else timer.setActiveTask(null)
  }, [tasks, dataLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep detailModalTask in sync with latest task data
  useEffect(() => {
    if (!detailModalTask) return
    const updated = tasks.find(t => t.id === detailModalTask.id)
    if (updated) setDetailModalTask(updated)
    else setDetailModalTask(null) // task was deleted
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

  const showNowActiveBar = (timer.isRunning || timer.isPaused) && timer.activeTask !== null

  const handleCardClick = (task: BigTask) => {
    setFocusedTaskAndPersist(task)
  }

  const handleSettingsClick = (task: BigTask) => {
    setDetailModalTask(task)
  }

  const handleSetReminder = async (taskId: string, dateTime: string | null) => {
    await taskService.updateBigTaskReminder(taskId, dateTime)
    await fetchTasks()
  }

  const handleClearDone = async () => {
    if (!userId) return
    await taskService.clearCompletedTasks(userId)
    setShowClearConfirm(false)
    await fetchTasks()
  }

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
      </div>

      {/* Scrollable task stack */}
      <div className="flex-1 min-h-0 relative z-10">
        <div className="h-full">
          <div className={`max-w-lg mx-auto px-4 pt-8 overflow-y-auto h-full ${showNowActiveBar ? 'pb-40' : 'pb-24'}`}>
            {!dataLoaded ? (
              <div className="flex justify-center pt-16">
                <span className="text-gray-600 text-xs animate-pulse">Loading...</span>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {tasks.length === 0 ? (
                  <EmptyState emoji="🚀" message="No tasks yet. Type in a big task above and let's break it down!" />
                ) : (
                  (() => {
                    const grouped = groupTasks(tasks)
                    return (
                      <>
                        <TaskGroupSection
                          title="Planned"
                          emoji="📋"
                          tasks={grouped.planned}
                          onCardClick={handleCardClick}
                          onSettingsClick={handleSettingsClick}
                        />
                        <TaskGroupSection
                          title="Active"
                          emoji="✨"
                          tasks={grouped.active}
                          onCardClick={handleCardClick}
                          onSettingsClick={handleSettingsClick}
                        />
                        <TaskGroupSection
                          title="Done"
                          emoji="✅"
                          tasks={grouped.done}
                          onCardClick={handleCardClick}
                          onSettingsClick={handleSettingsClick}
                          onClear={() => setShowClearConfirm(true)}
                        />
                      </>
                    )
                  })()
                )}
              </motion.div>
            )}
          </div>
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
            onAutoSwap={(taskName) => setToastMessage(`Switched focus to ${taskName}`)}
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

      {/* Task Settings Sheet */}
      <TaskDetailModal
        task={detailModalTask}
        isOpen={detailModalTask !== null}
        onClose={() => setDetailModalTask(null)}
        onDelete={handleDelete}
        onSetReminder={handleSetReminder}
        onRecurrenceChange={fetchTasks}
      />

      {/* Clear done confirm modal */}
      <AnimatePresence>
        {showClearConfirm && (
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
              <p className="text-4xl mb-3">🗑️</p>
              <p className="text-white font-body text-sm mb-1">Clear all done tasks?</p>
              <p className="text-gray-400 text-xs mb-6">This will permanently delete all completed tasks.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 min-h-[44px] text-sm text-gray-400 border border-base-700 rounded-xl hover:bg-base-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearDone}
                  className="flex-1 min-h-[44px] text-sm text-red-400 border border-red-400/30 rounded-xl bg-red-400/10 hover:bg-red-400/20 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />

      <BottomNavBar />
    </div>
  )
}



