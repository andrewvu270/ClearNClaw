import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { TaskInputForm } from '../components/TaskInputForm'
import { TaskCard } from '../components/TaskCard'
import { EmptyState } from '../components/EmptyState'
import { BottomNavBar } from '../components/BottomNavBar'
import { breakDownTask } from '../services/agentService'
import * as taskService from '../services/taskService'
import { getActiveTasks, getDoneTasks } from '../utils/filters'
import type { BigTask } from '../types'

type Tab = 'active' | 'done'

export function TasksPage() {
  const [tasks, setTasks] = useState<BigTask[]>([])
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

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

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleSubmit = async (description: string) => {
    if (!userId) return
    setLoading(true)
    try {
      const { emoji, subTasks } = await breakDownTask(description)
      await taskService.createBigTask(userId, description, emoji, subTasks)
      await fetchTasks()
    } catch {
      // Agent timeout or error — could show toast here
    } finally {
      setLoading(false)
    }
  }

  const handleEditName = async (taskId: string, name: string) => {
    await taskService.updateBigTaskName(taskId, name)
    await fetchTasks()
  }

  const handleDelete = async (taskId: string) => {
    await taskService.deleteBigTask(taskId)
    await fetchTasks()
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

  const displayed = tab === 'active' ? getActiveTasks(tasks) : getDoneTasks(tasks)

  return (
    <div className="min-h-screen bg-base-900 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-neon-cyan text-xs text-center mb-6">ADHD Task Breaker</h1>

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
                <TaskCard
                  key={task.id}
                  task={task}
                  onEditName={handleEditName}
                  onDelete={handleDelete}
                  onToggleSubTask={handleToggleSubTask}
                  onEditSubTaskName={handleEditSubTaskName}
                  onDeleteSubTask={handleDeleteSubTask}
                  onAddSubTask={handleAddSubTask}
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
