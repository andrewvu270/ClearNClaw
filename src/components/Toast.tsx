import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ToastProps {
  message: string | null
  onDismiss: () => void
  durationMs?: number
}

export function Toast({ message, onDismiss, durationMs = 1500 }: ToastProps) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!message) return
    const timeout = setTimeout(() => onDismissRef.current(), durationMs)
    return () => clearTimeout(timeout)
  }, [message, durationMs])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-14 inset-x-0 mx-auto w-fit z-[70] px-5 py-2.5 bg-base-800/90 backdrop-blur-sm border border-neon-cyan/20 rounded-2xl text-white text-sm font-body shadow-lg max-w-[85vw] text-center"
          data-testid="toast-notification"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
