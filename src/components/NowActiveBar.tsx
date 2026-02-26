import { motion } from 'framer-motion'
import type { BigTask } from '../types'

export interface NowActiveBarProps {
  task: BigTask
  remainingSeconds: number
  isPaused: boolean
  onClick: () => void
  onCancel: () => void
}

export function NowActiveBar({ task, remainingSeconds, onClick, onCancel }: NowActiveBarProps) {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <motion.button
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onClick={onClick}
      className="fixed bottom-[84px] left-0 right-0 z-40 mx-auto max-w-lg px-4"
      data-testid="now-active-bar"
      aria-label="Now active timer"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(10, 22, 40, 0.7) 0%, rgba(20, 10, 40, 0.7) 100%)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid rgba(0, 229, 255, 0.15)',
          boxShadow: '0 4px 24px rgba(0, 229, 255, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.04) inset',
        }}
      >
        {/* Task emoji */}
        <span
          className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 select-none text-xl"
          style={{ backgroundColor: 'rgba(255, 182, 216, 0.68)' }}
          data-testid="now-active-emoji"
        >
          {task.emoji}
        </span>

        {/* Task name (truncated) */}
        <span
          className="flex-1 min-w-0 text-sm text-gray-200 truncate text-left"
          data-testid="now-active-name"
        >
          {task.name}
        </span>

        {/* Remaining time */}
        <span
          className="text-sm font-mono text-neon-cyan shrink-0"
          data-testid="now-active-time"
        >
          {timeDisplay}
        </span>

        {/* Cancel button */}
        <span
          role="button"
          tabIndex={0}
          aria-label="Cancel timer"
          data-testid="now-active-cancel"
          onClick={(e) => {
            e.stopPropagation()
            onCancel()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              onCancel()
            }
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full shrink-0 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          ✕
        </span>
      </div>
    </motion.button>
  )
}
