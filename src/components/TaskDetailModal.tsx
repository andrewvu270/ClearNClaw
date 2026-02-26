import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BigTask, RepeatOption } from '../types'

interface TaskDetailModalProps {
  task: BigTask | null
  isOpen: boolean
  onClose: () => void
  onDelete: (taskId: string) => void
  onSetReminder: (taskId: string, dateTime: string | null) => void
  onSetRepeat: (taskId: string, repeat: RepeatOption | null) => void
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onDelete,
  onSetReminder,
  onSetRepeat,
}: TaskDetailModalProps) {
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderValue, setReminderValue] = useState('')
  const [repeatValue, setRepeatValue] = useState<RepeatOption | ''>('')

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      const hasReminder = !!task.reminderAt
      setReminderEnabled(hasReminder)
      setReminderValue(hasReminder ? toLocalDatetime(task.reminderAt!) : '')
      setRepeatValue(task.repeatSchedule ?? '')
    }
  }, [task?.id, task?.reminderAt, task?.repeatSchedule]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null

  const handleDelete = () => {
    onDelete(task.id)
    onClose()
  }

  const handleReminderToggle = () => {
    const next = !reminderEnabled
    setReminderEnabled(next)
    if (!next) {
      setReminderValue('')
      onSetReminder(task.id, null)
    }
  }

  const handleReminderChange = (value: string) => {
    setReminderValue(value)
    if (value) {
      onSetReminder(task.id, new Date(value).toISOString())
    }
  }

  const handleRepeatChange = (value: string) => {
    const repeat = value === '' ? null : (value as RepeatOption)
    setRepeatValue(value as RepeatOption | '')
    onSetRepeat(task.id, repeat)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Full-screen slide-up sheet */}
          <motion.div
            key="settings-sheet"
            data-testid="settings-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex flex-col bg-base-900"
          >
            {/* Header with close button */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-6 pb-2">
              <div className="w-10" />
              <h2 className="text-lg font-semibold text-gray-200">Task Settings</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Close settings sheet"
                data-testid="settings-close-btn"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="max-w-lg mx-auto space-y-6 pt-4">
                {/* Task name (read-only label) */}
                <div className="flex items-center gap-3 justify-center">
                  <span className="text-3xl">{task.emoji}</span>
                  <span className="text-xl font-semibold text-gray-200" data-testid="settings-task-name">
                    {task.name}
                  </span>
                </div>

                <hr className="border-gray-700" />

                {/* Reminder toggle */}
                <div data-testid="settings-reminder">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔔</span>
                      <span className="text-gray-200 font-medium">Reminder</span>
                    </div>
                    <button
                      onClick={handleReminderToggle}
                      data-testid="settings-reminder-toggle"
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        reminderEnabled ? 'bg-neon-cyan' : 'bg-gray-600'
                      }`}
                      role="switch"
                      aria-checked={reminderEnabled}
                      aria-label="Toggle reminder"
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                          reminderEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {reminderEnabled && (
                    <div className="mt-3 ml-8">
                      <input
                        type="datetime-local"
                        value={reminderValue}
                        onChange={(e) => handleReminderChange(e.target.value)}
                        data-testid="settings-reminder-picker"
                        className="w-full bg-base-800 text-gray-200 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan"
                      />
                    </div>
                  )}
                </div>

                {/* Repeat option */}
                <div data-testid="settings-repeat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔁</span>
                      <span className="text-gray-200 font-medium">Repeat</span>
                    </div>
                    <select
                      value={repeatValue}
                      onChange={(e) => handleRepeatChange(e.target.value)}
                      data-testid="settings-repeat-select"
                      className="bg-base-800 text-gray-200 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan"
                      aria-label="Repeat schedule"
                    >
                      <option value="">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <hr className="border-gray-700" />

                {/* Delete task button */}
                <div className="pt-2">
                  <button
                    onClick={handleDelete}
                    data-testid="settings-delete-btn"
                    className="w-full px-6 py-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <span>🗑</span>
                    <span>Delete Task</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
