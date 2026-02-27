import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Aurora } from './Aurora'
import { CircularProgressEmoji } from './CircularProgressEmoji'
import { SubTaskItem } from './SubTaskItem'
import { DurationPicker } from './DurationPicker'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import type { BigTask } from '../types'

export interface FocusViewProps {
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
  onAutoSwap?: (taskName: string) => void
}

export function FocusView({
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
  onAutoSwap,
}: FocusViewProps) {
  const doneCount = task.subTasks.filter(st => st.completed).length
  const timer = useFocusTimer()

  const [showDurationPicker, setShowDurationPicker] = useState(false)

  // Timer belongs to this task only if activeTask matches
  const isTimerForThisTask = timer.activeTask?.id === task.id
  const timerRunningHere = isTimerForThisTask && timer.isRunning
  const timerPausedHere = isTimerForThisTask && timer.isPaused
  const timerActiveHere = timerRunningHere || timerPausedHere

  const displayProgress = timerActiveHere && timer.totalSeconds > 0
    ? 1 - (timer.remainingSeconds / timer.totalSeconds)
    : 0

  useEffect(() => {
    if (timer.remainingSeconds === 0 && timerRunningHere) {
      timer.stop()
    }
  }, [timer.remainingSeconds, timerRunningHere]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (task.completed && timerRunningHere) {
      timer.pause()
    }
  }, [task.completed, timerRunningHere]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartTimer = () => {
    setShowDurationPicker(true)
  }

  const handleConfirmDuration = (durationMs: number) => {
    // Auto-swap: if a timer is active on a different task, notify the caller
    const timerActive = timer.isRunning || timer.isPaused
    const differentTask = timer.activeTask && timer.activeTask.id !== task.id
    if (timerActive && differentTask) {
      onAutoSwap?.(task.name)
    }

    timer.stop()
    timer.start(durationMs, false)
    timer.setActiveTask(task)
    setShowDurationPicker(false)
  }

  const handlePauseTimer = () => {
    timer.pause()
  }

  const handleResumeTimer = () => {
    timer.resume()
  }

  const handleResetTimer = () => {
    setShowDurationPicker(true)
  }

  const handleCancelPicker = () => {
    setShowDurationPicker(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[60] bg-base-900 overflow-y-auto"
      data-testid="focus-view"
    >
      <div className="absolute inset-0 pointer-events-none">
        <Aurora colorStops={['#00e5ff', '#064e3b', '#ff1493']} amplitude={1.2} speed={0.8} blend={0.6} />
      </div>

      {showDurationPicker && (
        <DurationPicker
          onConfirm={handleConfirmDuration}
          onCancel={handleCancelPicker}
        />
      )}

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-6 pb-24">
        {/* Swipe handle + Back button */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.3 }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 100) onClose()
          }}
          className="flex items-center justify-between mb-1 touch-none"
        >
          <button
            onClick={onClose}
            className="min-w-[60px] min-h-[60px] flex items-center justify-center text-gray-400 hover:text-white transition-colors text-4xl font-pixel"
            aria-label="Back"
          >
            ←
          </button>
        </motion.div>

        {/* Task name */}
        <div className="text-center mb-1">
          {readOnly ? (
            <p className="text-white font-body text-2xl" data-testid="focus-task-name-readonly">{task.name}</p>
          ) : (
            <EditableTaskName
              name={task.name}
              onSave={(name) => onEditName(task.id, name)}
            />
          )}
        </div>

        <p className="text-gray-400 text-xs text-center mb-3" data-testid="focus-progress-text">
          {doneCount}/{task.subTasks.length} done
        </p>

        {/* Emoji + progress ring */}
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

          {!readOnly && timerActiveHere ? (
            <div className="flex items-center justify-center gap-4 mt-4" data-testid="focus-timer-controls">
              {timerRunningHere ? (
                <button
                  onClick={handlePauseTimer}
                  className="flex items-center justify-center text-gray-300 hover:text-white transition-colors text-lg"
                  aria-label="Pause timer"
                >
                  ⏸
                </button>
              ) : (
                <button
                  onClick={handleResumeTimer}
                  className="flex items-center justify-center text-gray-300 hover:text-white transition-colors text-lg"
                  aria-label="Resume timer"
                >
                  ▶
                </button>
              )}
              <div className="text-3xl font-mono text-neon-cyan" data-testid="focus-timer-display">
                {String(Math.floor(timer.remainingSeconds / 60)).padStart(2, '0')}:
                {String(timer.remainingSeconds % 60).padStart(2, '0')}
              </div>
              <button
                onClick={handleResetTimer}
                className="flex items-center justify-center text-gray-300 hover:text-white transition-colors text-lg"
                aria-label="Reset timer"
              >
                🔄
              </button>
            </div>
          ) : !readOnly && (
            <button
              onClick={handleStartTimer}
              className="mt-4 px-6 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan rounded-full hover:bg-neon-cyan/30 transition-colors text-sm"
              data-testid="focus-start-timer-btn"
            >
              Start Timer
            </button>
          )}
        </div>

        {/* Subtasks */}
        <div data-testid="focus-subtasks-area">
          <div className="space-y-1">
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

          {!readOnly && <AddSubTaskInput onAdd={(name) => onAddSubTask(task.id, name)} />}
        </div>
      </div>
    </motion.div>
  )
}

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
    <div className="flex items-center gap-2 mt-4" data-testid="focus-add-subtask">
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
      <div className="flex flex-col items-center gap-3" data-testid="focus-emoji-editing">
        <CircularProgressEmoji emoji={value || emoji} progress={progress} size={225} />
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setValue(emoji); setEditing(false) } }}
          className="w-20 text-center text-2xl bg-base-800 rounded-xl border border-neon-cyan/30 outline-none focus:border-neon-cyan py-1"
          maxLength={4}
          autoFocus
          data-testid="focus-emoji-input"
        />
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="active:scale-95 transition-transform" data-testid="focus-emoji-editable">
      <CircularProgressEmoji emoji={emoji} progress={progress} size={225} />
    </button>
  )
}

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
        data-testid="focus-name-input"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-white font-body text-2xl hover:text-neon-cyan transition-colors cursor-text"
      data-testid="focus-task-name-editable"
    >
      {name}
    </button>
  )
}
