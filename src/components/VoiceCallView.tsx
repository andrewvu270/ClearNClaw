import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ASSISTANT_CHARACTERS } from '../services/assistantPrompt'
import type { VoiceState } from '../types/assistant'

/**
 * Voice transcript entry for displaying conversation
 */
export interface VoiceTranscript {
  id: string
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
}

interface VoiceCallViewProps {
  state: VoiceState
  transcripts: VoiceTranscript[]
  error: string | null
  onEndCall: () => void
  onRetry: () => void
}

/**
 * VoiceCallView - Shows Klaw's voice call interface
 * Displays Klaw's image, real-time transcript, and end call button
 * Requirements: 3.2, 3.3
 */
export function VoiceCallView({
  state,
  transcripts,
  error,
  onEndCall,
  onRetry,
}: VoiceCallViewProps) {
  const klaw = ASSISTANT_CHARACTERS.klaw
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcripts])

  const isActive = state === 'active'
  const isConnecting = state === 'connecting'
  const isError = state === 'error'

  return (
    <div className="h-full flex flex-col items-center pt-4 pb-24">
      {/* Klaw's avatar with status indicator */}
      <div className="relative mb-4">
        <motion.div
          className="w-28 h-28 rounded-full overflow-hidden border-4 border-base-700"
          animate={isActive ? { borderColor: ['#FF6B9D', '#FF8FB3', '#FF6B9D'] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <img
            src={klaw.image}
            alt={klaw.name}
            className="w-full h-full object-contain"
          />
        </motion.div>
        
        {/* Status indicator dot */}
        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-base-900 ${
          isActive ? 'bg-green-500' :
          isConnecting ? 'bg-yellow-500 animate-pulse' :
          isError ? 'bg-red-500' :
          'bg-gray-500'
        }`} />
      </div>

      {/* Name and status */}
      <h2 className="text-white text-xl font-medium mb-1">{klaw.name}</h2>
      <p className={`text-sm mb-4 ${
        isActive ? 'text-green-400' :
        isConnecting ? 'text-yellow-400' :
        isError ? 'text-red-400' :
        'text-gray-500'
      }`}>
        {isConnecting && 'Connecting...'}
        {isActive && 'Call in progress'}
        {isError && 'Connection failed'}
        {state === 'idle' && 'Call ended'}
      </p>

      {/* Call controls - moved up, before transcript */}
      <div className="flex flex-col items-center gap-2 mb-6">
        {isError && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRetry}
            className="px-8 py-4 bg-neon-pink/20 border border-neon-pink/50 rounded-2xl text-neon-pink hover:bg-neon-pink/30 transition-colors"
          >
            Try Again
          </motion.button>
        )}
        
        {(isActive || isConnecting) && (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEndCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
              aria-label="End call"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-7 h-7 text-white"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
                  clipRule="evenodd"
                />
                <path d="M19.28 4.72a.75.75 0 0 0-1.06 0L15 7.94l-3.22-3.22a.75.75 0 0 0-1.06 1.06L13.94 9l-3.22 3.22a.75.75 0 1 0 1.06 1.06L15 10.06l3.22 3.22a.75.75 0 1 0 1.06-1.06L16.06 9l3.22-3.22a.75.75 0 0 0 0-1.06Z" />
              </svg>
            </motion.button>
            <p className="text-gray-500 text-xs">Tap to end call anytime</p>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl max-w-sm">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Transcript area */}
      <div className="flex-1 w-full max-w-sm overflow-y-auto mb-6 px-2">
        {transcripts.length === 0 && isActive && (
          <p className="text-gray-500 text-sm text-center mt-8">
            Start talking to Klaw...
          </p>
        )}
        
        {transcripts.map((transcript) => (
          <motion.div
            key={transcript.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: transcript.isFinal ? 1 : 0.6, y: 0 }}
            className={`flex mb-3 ${
              transcript.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Klaw's avatar for assistant messages */}
            {transcript.role === 'assistant' && (
              <div className="w-14 h-14 mr-2 shrink-0 mt-1 rounded-full overflow-hidden border-2 border-base-700 bg-base-800">
                <img
                  src={klaw.image}
                  alt={klaw.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                transcript.role === 'user'
                  ? 'bg-neon-cyan/30 text-white rounded-br-md border border-neon-cyan/40'
                  : 'bg-base-800 text-gray-200 rounded-bl-md border border-base-700'
              } ${!transcript.isFinal ? 'opacity-60' : ''}`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{transcript.text}</p>
            </div>
          </motion.div>
        ))}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  )
}
