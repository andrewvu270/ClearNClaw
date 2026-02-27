import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BigTask } from '../types'
import { RecurrenceConfig as RecurrenceConfigComponent } from './RecurrenceConfig'
import { setRecurrence, removeRecurrence } from '../services/recurrenceService'
import { isPushSupported } from '../services/pushService'
import type { RecurrenceConfig as RecurrenceConfigType } from '../utils/recurrence'

interface TaskDetailModalProps {
  task: BigTask | null
  isOpen: boolean
  onClose: () => void
  onDelete: (taskId: string) => void
  onSetReminder: (taskId: string, dateTime: string | null) => void
  onRecurrenceChange?: () => void
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onDelete,
  onSetReminder,
  onRecurrenceChange,
}: TaskDetailModalProps) {
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderValue, setReminderValue] = useState('')
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType | null>(null)
  const [pushActive, setPushActive] = useState(true)

  // Check if push is actually active (subscription exists)
  useEffect(() => {
    if (!isPushSupported()) {
      setPushActive(false)
      return
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushActive(!!sub))
      .catch(() => setPushActive(false))
  }, [isOpen])

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      const hasReminder = !!task.reminderAt
      setReminderEnabled(hasReminder)
      setReminderValue(hasReminder ? toLocalDatetime(task.reminderAt!) : '')
      if (task.recurrence) {
        setRecurrenceConfig({
          type: task.recurrence.type,
          customDays: task.recurrence.customDays,
        })
      } else {
        setRecurrenceConfig(null)
      }
    }
  }, [task?.id, task?.reminderAt, task?.recurrence]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null

  const handleDelete = () => {
    onDelete(task.id)
    onClose()
  }

  const handleReminderToggle = async () => {
    const next = !reminderEnabled
    setReminderEnabled(next)
    if (!next) {
      setReminderValue('')
      onSetReminder(task.id, null)
      // Also clear recurrence when reminder is turned off
      if (recurrenceConfig) {
        setRecurrenceConfig(null)
        try {
          await removeRecurrence(task.id)
          onRecurrenceChange?.()
        } catch (err) {
          console.error('Failed to remove recurrence:', err)
        }
      }
    }
  }

  const handleReminderChange = (value: string) => {
    setReminderValue(value)
    if (value) {
      onSetReminder(task.id, new Date(value).toISOString())
    }
  }

  const handleRecurrenceChange = async (config: RecurrenceConfigType | null) => {
    setRecurrenceConfig(config)
    try {
      if (config) {
        await setRecurrence(task.id, config)
      } else {
        await removeRecurrence(task.id)
      }
      onRecurrenceChange?.()
    } catch (err) {
      console.error('Failed to update recurrence:', err)
    }
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
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100) onClose()
            }}
            className="fixed inset-0 z-[60] flex flex-col bg-base-900"
          >
            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-4">
              <div className="max-w-lg mx-auto px-4 pt-6">
                {/* Back button */}
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={onClose}
                    className="min-w-[60px] min-h-[60px] flex items-center justify-center text-gray-400 hover:text-white transition-colors text-4xl font-pixel"
                    aria-label="Back"
                    data-testid="settings-close-btn"
                  >
                    ←
                  </button>
                </div>
                <h2 className="text-lg font-pixel text-gray-200 text-center mb-4">Task Settings</h2>
              </div>
              <div className="max-w-lg mx-auto px-6 space-y-6">
                {/* Task name */}
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
                      {!pushActive && (
                        <p className="text-neon-pink text-xs mb-2">
                          ⚠️ Enable Push Notifications in Profile → Settings for reminders to work
                        </p>
                      )}
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

                {/* Recurrence config (only show when reminder is set) */}
                {reminderEnabled && reminderValue && (
                  <div data-testid="settings-recurrence">
                    <RecurrenceConfigComponent
                      value={recurrenceConfig}
                      onChange={handleRecurrenceChange}
                    />
                  </div>
                )}

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
