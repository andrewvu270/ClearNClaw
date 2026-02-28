import { motion } from 'framer-motion'
import type { VoiceState } from '../types/assistant'

interface VoiceCallButtonProps {
  state: VoiceState
  onStartCall: () => void
  onEndCall: () => void
  disabled?: boolean
}

/**
 * VoiceCallButton - Shows call/end call button based on voice state
 * Displays visual indicator for call state (idle, connecting, active, error)
 * Requirements: 1.3, 3.1, 3.2, 3.3
 */
export function VoiceCallButton({
  state,
  onStartCall,
  onEndCall,
  disabled,
}: VoiceCallButtonProps) {
  const isActive = state === 'active'
  const isConnecting = state === 'connecting'
  const isError = state === 'error'

  const handleClick = () => {
    if (disabled) return
    if (isActive || isConnecting) {
      onEndCall()
    } else {
      onStartCall()
    }
  }

  // Button colors based on state
  const getButtonStyles = () => {
    if (isActive) {
      return 'bg-red-500 hover:bg-red-600 border-red-400'
    }
    if (isConnecting) {
      return 'bg-yellow-500/20 border-yellow-400/50 cursor-wait'
    }
    if (isError) {
      return 'bg-red-500/20 border-red-400/50'
    }
    // idle
    return 'bg-neon-pink/20 hover:bg-neon-pink/30 border-neon-pink/50'
  }

  // Icon based on state
  const getIcon = () => {
    if (isActive) {
      // End call icon
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path
            fillRule="evenodd"
            d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
            clipRule="evenodd"
          />
          <path d="M19.28 4.72a.75.75 0 0 0-1.06 0L15 7.94l-3.22-3.22a.75.75 0 0 0-1.06 1.06L13.94 9l-3.22 3.22a.75.75 0 1 0 1.06 1.06L15 10.06l3.22 3.22a.75.75 0 1 0 1.06-1.06L16.06 9l3.22-3.22a.75.75 0 0 0 0-1.06Z" />
        </svg>
      )
    }
    if (isConnecting) {
      // Loading spinner
      return (
        <svg
          className="w-6 h-6 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )
    }
    // Idle or error - phone icon
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
      >
        <path
          fillRule="evenodd"
          d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  // Status text
  const getStatusText = () => {
    if (isActive) return 'End call'
    if (isConnecting) return 'Connecting...'
    if (isError) return 'Retry call'
    return 'Start call'
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        whileHover={disabled || isConnecting ? {} : { scale: 1.05 }}
        whileTap={disabled || isConnecting ? {} : { scale: 0.95 }}
        onClick={handleClick}
        disabled={disabled || isConnecting}
        className={`
          w-16 h-16 rounded-full border-2 flex items-center justify-center
          transition-colors duration-200
          ${getButtonStyles()}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isActive ? 'text-white' : 'text-neon-pink'}
        `}
        aria-label={getStatusText()}
      >
        {getIcon()}
      </motion.button>
      
      {/* State indicator */}
      <span className={`text-xs ${
        isActive ? 'text-red-400' :
        isConnecting ? 'text-yellow-400' :
        isError ? 'text-red-400' :
        'text-gray-500'
      }`}>
        {getStatusText()}
      </span>

      {/* Pulsing ring for active call */}
      {isActive && (
        <motion.div
          className="absolute w-16 h-16 rounded-full border-2 border-red-500"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  )
}
