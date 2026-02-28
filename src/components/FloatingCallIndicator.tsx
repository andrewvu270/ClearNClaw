import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useVoiceCall } from '../contexts/VoiceCallContext'
import { ASSISTANT_CHARACTERS } from '../services/assistantPrompt'
import { useFocusTimer } from '../contexts/FocusTimerContext'

/**
 * FloatingCallIndicator - Shows Law's image when voice call is active
 * and user is not on the AssistantPage.
 * 
 * Positioned above the Now-Active Bar (higher z-index).
 * Tapping navigates back to AssistantPage.
 * 
 * Requirements: 15.2, 15.3, 15.5
 */
export function FloatingCallIndicator() {
  const navigate = useNavigate()
  const location = useLocation()
  const { voiceState } = useVoiceCall()
  const timer = useFocusTimer()

  // Only show when voice call is active and NOT on AssistantPage
  const isOnAssistantPage = location.pathname === '/assistant'
  const isCallActive = voiceState === 'active' || voiceState === 'connecting'
  const showIndicator = isCallActive && !isOnAssistantPage

  // Check if Now-Active Bar is visible (timer running or paused)
  const isTimerBarVisible = timer.isRunning || timer.isPaused

  if (!showIndicator) {
    return null
  }

  const law = ASSISTANT_CHARACTERS.law

  // Position above Now-Active Bar when it's visible
  // NowActiveBar is at bottom-[84px], so we position this higher
  // When timer bar is visible: bottom-[148px] (84 + 64 for bar height)
  // When timer bar is hidden: bottom-[84px] (same as where bar would be)
  const bottomPosition = isTimerBarVisible ? 'bottom-[148px]' : 'bottom-[84px]'

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onClick={() => navigate('/assistant')}
      className={`fixed ${bottomPosition} right-4 z-50`}
      aria-label="Return to voice call with Law"
    >
      <div
        className="relative w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 200, 100, 0.9) 0%, rgba(255, 150, 50, 0.9) 100%)',
          boxShadow: '0 4px 20px rgba(255, 180, 80, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.2) inset',
        }}
      >
        {/* Law's image */}
        <img
          src={law.image}
          alt={law.name}
          className="w-10 h-10 object-contain"
        />

        {/* Pulsing ring animation for active call */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-yellow-400"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.8, 0, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Connecting state indicator */}
        {voiceState === 'connecting' && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
            <motion.div
              className="w-2 h-2 bg-white rounded-full"
              animate={{ scale: [1, 0.5, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </div>
        )}

        {/* Active state indicator */}
        {voiceState === 'active' && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        )}
      </div>
    </motion.button>
  )
}
