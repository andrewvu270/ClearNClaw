import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BottomNavBar } from '../components/BottomNavBar'
import { ChatView } from '../components/ChatView'
import { ChatInput } from '../components/ChatInput'
import { AssistantPicker } from '../components/AssistantPicker'
import { VoiceCallView } from '../components/VoiceCallView'
import DotGrid from '../components/DotGrid'
import { loadMessages, saveMessage, clearMessages } from '../utils/chatStorage'
import { createAssistantContext } from '../services/assistantContext'
import {
  sendMessage,
  createChatServiceState,
  type ChatServiceState,
} from '../services/chatService'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import { useVoiceCall } from '../contexts/VoiceCallContext'
import { ASSISTANT_CHARACTERS } from '../services/assistantPrompt'
import type { ChatMessage, AssistantContext, TimerState } from '../types/assistant'
import type { BigTask } from '../types'

type AssistantMode = 'picker' | 'chat' | 'voice'

/**
 * Generates a unique ID for messages
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * AssistantPage - Main page for chat and voice assistant interaction
 * Shows character picker first, then the selected assistant's interface
 * Requirements: 1.1, 1.2, 14.2
 */
export function AssistantPage() {
  const [mode, setMode] = useState<AssistantMode>('picker')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [context, setContext] = useState<AssistantContext | null>(null)
  const [chatState, setChatState] = useState<ChatServiceState>(
    createChatServiceState()
  )
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  // Voice call state from context (Requirements: 3.1, 3.2, 3.4, 15.1)
  const voiceCall = useVoiceCall()

  const timer = useFocusTimer()
  const contextRef = useRef<AssistantContext | null>(null)

  // Keep contextRef in sync
  useEffect(() => {
    contextRef.current = context
  }, [context])

  // Get user session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
      }
    })
  }, [])

  // Load chat history and task context when userId is available
  useEffect(() => {
    if (!userId) return

    // Load chat history from localStorage
    const storedMessages = loadMessages(userId)
    setMessages(storedMessages)

    // Always show picker first - user can choose which assistant to use
    // (Don't auto-switch to chat mode even if there's history)

    // Build timer state from context
    const timerState: TimerState | null =
      timer.isRunning || timer.isPaused
        ? {
            isRunning: timer.isRunning,
            isPaused: timer.isPaused,
            remainingSeconds: timer.remainingSeconds,
            totalSeconds: timer.totalSeconds,
            activeTaskId: timer.activeTask?.id ?? null,
          }
        : null

    // Load task context
    createAssistantContext(userId, timerState, storedMessages).then((ctx) => {
      setContext(ctx)
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update context when timer state changes
  useEffect(() => {
    if (!context) return

    const timerState: TimerState | null =
      timer.isRunning || timer.isPaused
        ? {
            isRunning: timer.isRunning,
            isPaused: timer.isPaused,
            remainingSeconds: timer.remainingSeconds,
            totalSeconds: timer.totalSeconds,
            activeTaskId: timer.activeTask?.id ?? null,
          }
        : null

    setContext((prev) => (prev ? { ...prev, timerState } : null))
  }, [timer.isRunning, timer.isPaused, timer.remainingSeconds, timer.activeTask])

  // If voice call is active, always show voice mode (can't chat while calling)
  useEffect(() => {
    if (voiceCall.voiceState === 'active' || voiceCall.voiceState === 'connecting') {
      setMode('voice')
    }
  }, [voiceCall.voiceState])

  /**
   * Timer controller for assistant functions
   */
  const timerController = {
    start: (durationMs: number) => {
      timer.start(durationMs)
    },
    pause: () => timer.pause(),
    resume: () => timer.resume(),
    stop: () => timer.stop(),
    getState: () => {
      if (!timer.isRunning && !timer.isPaused) return null
      return {
        isRunning: timer.isRunning,
        isPaused: timer.isPaused,
        remainingSeconds: timer.remainingSeconds,
        totalSeconds: timer.totalSeconds,
        activeTaskId: timer.activeTask?.id ?? null,
      }
    },
    setActiveTask: (task: BigTask | null) => timer.setActiveTask(task),
  }

  /**
   * Start voice call with Klaw
   * Requirements: 3.1, 3.2
   */
  const handleStartVoiceCall = useCallback(async () => {
    if (!context) return

    try {
      await voiceCall.startCall(context, timerController)
    } catch (error) {
      console.error('Failed to start voice call:', error)
    }
  }, [context, timerController, voiceCall])

  /**
   * End voice call
   * Requirements: 3.2
   */
  const handleEndVoiceCall = useCallback(() => {
    voiceCall.endCall()
  }, [voiceCall])

  /**
   * Handle assistant mode selection
   */
  const handleSelectMode = useCallback(
    (selectedMode: 'chat' | 'voice') => {
      if (selectedMode === 'voice') {
        // Check if Vapi is available
        if (!voiceCall.isAvailable) {
          return
        }
        setMode('voice')
        // Only start a new call if not already in a call
        if (voiceCall.voiceState !== 'active' && voiceCall.voiceState !== 'connecting') {
          handleStartVoiceCall()
        }
        return
      }
      setMode(selectedMode)
    },
    [handleStartVoiceCall, voiceCall.isAvailable, voiceCall.voiceState]
  )

  /**
   * Handle going back to picker
   */
  const handleBackToPicker = useCallback(() => {
    // End voice call if active
    if (voiceCall.voiceState === 'active' || voiceCall.voiceState === 'connecting') {
      handleEndVoiceCall()
    }
    setMode('picker')
  }, [voiceCall.voiceState, handleEndVoiceCall])

  /**
   * Handle sending a message
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!userId || !context || isLoading) return

      // Create user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content,
        timestamp: new Date(),
      }

      // Add user message to state and persist
      setMessages((prev) => [...prev, userMessage])
      saveMessage(userId, userMessage)

      // Update context with new message
      const updatedContext: AssistantContext = {
        ...context,
        conversationHistory: [...context.conversationHistory, userMessage],
      }
      setContext(updatedContext)

      setIsLoading(true)

      try {
        // Send message to chat service
        const result = await sendMessage(
          content,
          updatedContext,
          chatState,
          timerController
        )

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          functionCalls: result.functionResults.map((r) => ({
            name: r.message,
            success: r.success,
            result: r.data,
            error: r.error,
          })),
        }

        // Add assistant message to state and persist
        setMessages((prev) => [...prev, assistantMessage])
        saveMessage(userId, assistantMessage)

        // Update context and state
        setContext({
          ...result.updatedContext,
          conversationHistory: [
            ...result.updatedContext.conversationHistory,
            assistantMessage,
          ],
        })
        setChatState(result.updatedState)
      } catch (error) {
        console.error('Failed to send message:', error)

        // Create error message with more detail in dev
        const errorDetail = error instanceof Error ? error.message : 'Unknown error'
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: `Sorry, I ran into an issue: ${errorDetail}. Please try again.`,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, errorMessage])
        saveMessage(userId, errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [userId, context, chatState, isLoading, timerController]
  )

  /**
   * Handle clearing chat history
   */
  const handleClearChat = useCallback(() => {
    if (!userId) return
    clearMessages(userId)
    setMessages([])
    setShowClearConfirm(false)
    setMode('picker') // Go back to picker after clearing

    // Reset context conversation history
    if (context) {
      setContext({
        ...context,
        conversationHistory: [],
        lastReferencedTaskId: null,
        lastReferencedSubtaskId: null,
      })
    }
    setChatState(createChatServiceState())
  }, [userId, context])

  const clea = ASSISTANT_CHARACTERS.clea
  const currentAssistant = mode === 'voice' ? ASSISTANT_CHARACTERS.klaw : clea

  return (
    <div className="h-screen bg-base-900 flex flex-col relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none">
        <DotGrid
          dotSize={6}
          gap={20}
          baseColor="#271E37"
          activeColor="#5227FF"
          proximity={150}
          shockRadius={250}
          shockStrength={4}
          returnDuration={1.0}
        />
      </div>

      {/* Header - only show in chat/voice mode */}
      {mode !== 'picker' && (
        <div className="shrink-0 max-w-lg mx-auto w-full px-4 pt-12 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBackToPicker}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="w-6 h-6">
                <img
                  src={currentAssistant.image}
                  alt={currentAssistant.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-sm">{currentAssistant.name}</span>
            </button>
            {mode === 'chat' && messages.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Clear chat"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-h-0 relative z-10">
        <div className="h-full max-w-lg mx-auto px-4">
          {mode === 'picker' && (
            <AssistantPicker
              onSelect={handleSelectMode}
              voiceDisabled={!voiceCall.isAvailable}
              voiceDisabledReason={!voiceCall.isAvailable ? 'Voice not configured' : undefined}
              chatDisabled={voiceCall.voiceState === 'active' || voiceCall.voiceState === 'connecting'}
              chatDisabledReason="End call first"
            />
          )}
          {mode === 'chat' && (
            <ChatView messages={messages} isLoading={isLoading} hasBottomBar={timer.isRunning || timer.isPaused} />
          )}
          {mode === 'voice' && (
            <VoiceCallView
              state={voiceCall.voiceState}
              transcripts={voiceCall.transcripts}
              error={voiceCall.error}
              onEndCall={handleEndVoiceCall}
              onRetry={handleStartVoiceCall}
            />
          )}
        </div>
      </div>

      {/* Input area - only show in chat mode, fixed position */}
      {mode === 'chat' && (
        <div className="shrink-0 max-w-lg mx-auto w-full px-4 pb-24 relative z-10">
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading || !context}
            placeholder={context ? 'Message Clea...' : 'Loading...'}
          />
        </div>
      )}

      {/* Clear chat confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6">
          <div className="bg-base-800 border border-base-700 rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <p className="text-white font-body text-sm mb-1">
              Clear chat history?
            </p>
            <p className="text-gray-400 text-xs mb-6">
              This will delete all messages in this conversation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 min-h-[44px] text-sm text-gray-400 border border-base-700 rounded-xl hover:bg-base-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="flex-1 min-h-[44px] text-sm text-red-400 border border-red-400/30 rounded-xl bg-red-400/10 hover:bg-red-400/20 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavBar />
    </div>
  )
}
