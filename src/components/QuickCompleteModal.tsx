import { motion, AnimatePresence } from 'framer-motion'
import type { BigTask } from '../types'
import { energyTagToCoins } from '../utils/energyTag'

interface QuickCompleteModalProps {
  task: BigTask | null
  isOpen: boolean
  onConfirm: (taskId: string) => void
  onCancel: () => void
}

export function QuickCompleteModal({ task, isOpen, onConfirm, onCancel }: QuickCompleteModalProps) {
  if (!task) return null

  const coins = energyTagToCoins(task.energyTag)

  return (
    <AnimatePresence>
      {isOpen && (
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
            <p className="text-gray-400 text-xs mb-6">
              Complete this task and earn {coins} coin{coins > 1 ? 's' : ''}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 min-h-[44px] text-sm text-gray-400 border border-base-700 rounded-xl hover:bg-base-700 transition-colors"
              >
                Not yet
              </button>
              <button
                onClick={() => onConfirm(task.id)}
                className="flex-1 min-h-[44px] text-sm text-neon-cyan border border-neon-cyan/30 rounded-xl bg-neon-cyan/10 hover:bg-neon-cyan/20 transition-colors"
              >
                Complete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
