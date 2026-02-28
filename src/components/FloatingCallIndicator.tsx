import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useVoiceCall } from '../contexts/VoiceCallContext'
import { ASSISTANT_CHARACTERS } from '../services/assistantPrompt'

/**
 * FloatingCallIndicator - Shows a bar when voice call is active
 * and user is not on the AssistantPage.
 *
 * Styled exactly like NowActiveBar for consistency.
 * Tapping navigates back to AssistantPage.
 *
 * Requirements: 15.2, 15.3, 15.5
 */
export function FloatingCallIndicator() {
  const navigate = useNavigate()
  const location = useLocation()
  const { voiceState, endCall } = useVoiceCall()

  // Only show when voice call is active and NOT on AssistantPage
  const isOnAssistantPage = location.pathname === '/assistant'
  const isCallActive = voiceState === 'active' || voiceState === 'connecting'
  const showIndicator = isCallActive && !isOnAssistantPage

  if (!showIndicator) {
    return null
  }

  const klaw = ASSISTANT_CHARACTERS.klaw
  const isConnecting = voiceState === 'connecting'

  const handleEndCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    endCall()
  }

  return (
    <motion.button
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onClick={() => navigate('/assistant')}
      className="fixed bottom-[84px] left-0 right-0 z-40 mx-auto max-w-lg px-4 touch-manipulation"
      aria-label="Return to voice call with Klaw"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(10, 22, 40, 0.7) 0%, rgba(20, 10, 40, 0.7) 100%)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid rgba(0, 229, 255, 0.15)',
          boxShadow:
            '0 4px 24px rgba(0, 229, 255, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.04) inset',
        }}
      >
        {/* Klaw's avatar */}
        <span
          className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 overflow-hidden"
          style={{ backgroundColor: 'rgba(255, 182, 216, 0.68)' }}
        >
          <img
            src={klaw.image}
            alt={klaw.name}
            className="w-7 h-7 object-contain"
          />
        </span>

        {/* Call status text */}
        <span className="flex-1 min-w-0 text-sm text-gray-200 truncate text-left">
          {isConnecting ? 'Connecting...' : 'On call with Klaw'}
        </span>

        {/* Status indicator - green dot for active, yellow pulsing for connecting */}
        {isConnecting ? (
          <motion.span
            className="w-2 h-2 rounded-full bg-yellow-400 shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        ) : (
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        )}

        {/* End call button */}
        <span
          role="button"
          tabIndex={0}
          aria-label="End call"
          onClick={handleEndCall}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              endCall()
            }
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full shrink-0 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </span>
      </div>
    </motion.button>
  )
}
