import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { getVapiService, type VapiService } from '../services/vapiService'
import type { AssistantContext, VoiceState } from '../types/assistant'
import type { TimerController } from '../services/assistantFunctions'

/**
 * Voice transcript entry for display
 */
export interface VoiceTranscript {
  id: string
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
}

/**
 * Voice call context state
 */
interface VoiceCallContextState {
  /** Current voice call state */
  voiceState: VoiceState
  /** Error message if any */
  error: string | null
  /** Voice transcripts from the call */
  transcripts: VoiceTranscript[]
  /** Whether Vapi is available (API key configured) */
  isAvailable: boolean
  /** Start a voice call with Law */
  startCall: (context: AssistantContext, timerController?: TimerController) => Promise<void>
  /** End the current voice call */
  endCall: () => void
  /** Clear error state */
  clearError: () => void
}

const VoiceCallContext = createContext<VoiceCallContextState | null>(null)

/**
 * Hook to access voice call context
 */
export function useVoiceCall(): VoiceCallContextState {
  const context = useContext(VoiceCallContext)
  if (!context) {
    throw new Error('useVoiceCall must be used within a VoiceCallProvider')
  }
  return context
}

interface VoiceCallProviderProps {
  children: ReactNode
}

/**
 * VoiceCallProvider - Manages Law's voice call state globally
 * 
 * This provider allows the voice call to persist when navigating away from
 * the AssistantPage, enabling users to multitask while talking to Law.
 * 
 * Requirements: 15.1
 */
export function VoiceCallProvider({ children }: VoiceCallProviderProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([])
  
  const vapiService = useRef<VapiService>(getVapiService())
  const isSetup = useRef(false)

  /**
   * Set up Vapi event handlers (only once)
   */
  useEffect(() => {
    if (isSetup.current) return
    isSetup.current = true

    const vapi = vapiService.current

    // Handle state changes
    vapi.onStateChange((state) => {
      setVoiceState(state)
      if (state === 'idle') {
        setError(null)
      }
    })

    // Handle transcripts (user speech)
    vapi.onTranscript((text, isFinal) => {
      setTranscripts((prev) => {
        // Find existing non-final user transcript to update (search from end)
        let lastUserIdx = -1
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'user' && !prev[i].isFinal) {
            lastUserIdx = i
            break
          }
        }

        if (lastUserIdx >= 0 && !isFinal) {
          // Update existing transcript
          const updated = [...prev]
          updated[lastUserIdx] = { ...updated[lastUserIdx], text }
          return updated
        }
        if (isFinal && lastUserIdx >= 0) {
          // Finalize existing transcript
          const updated = [...prev]
          updated[lastUserIdx] = { ...updated[lastUserIdx], text, isFinal: true }
          return updated
        }
        // Add new transcript
        return [
          ...prev,
          {
            id: `vt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            role: 'user' as const,
            text,
            isFinal,
          },
        ]
      })
    })

    // Handle assistant responses
    vapi.onResponse((text) => {
      setTranscripts((prev) => [
        ...prev,
        {
          id: `vt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant',
          text,
          isFinal: true,
        },
      ])
    })

    // Handle errors
    vapi.onError((err) => {
      setError(err.message || 'Connection failed')
      setVoiceState('error')
    })
  }, [])

  /**
   * Start a voice call with Law
   */
  const startCall = useCallback(async (
    context: AssistantContext,
    timerController?: TimerController
  ) => {
    setError(null)
    setTranscripts([])

    try {
      await vapiService.current.startSession(context, timerController)
    } catch (err) {
      console.error('Failed to start voice call:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setVoiceState('error')
      throw err
    }
  }, [])

  /**
   * End the current voice call
   */
  const endCall = useCallback(() => {
    vapiService.current.endSession()
    setVoiceState('idle')
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value: VoiceCallContextState = {
    voiceState,
    error,
    transcripts,
    isAvailable: vapiService.current.isAvailable(),
    startCall,
    endCall,
    clearError,
  }

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
    </VoiceCallContext.Provider>
  )
}
