import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../types/assistant'
import { ASSISTANT_CHARACTERS } from '../services/assistantPrompt'

interface ChatViewProps {
  messages: ChatMessage[]
  isLoading: boolean
}

/**
 * ChatView - Displays chat message history with auto-scroll
 * Features Lea as the chat assistant character
 * Requirements: 2.3, 2.4
 */
export function ChatView({ messages, isLoading }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lea = ASSISTANT_CHARACTERS.lea

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 mb-4">
          <img
            src={lea.image}
            alt={lea.name}
            className="w-full h-full object-contain"
          />
        </div>
        <p className="text-white text-sm font-medium mb-1">
          Hi, I'm {lea.name}
        </p>
        <p className="text-gray-400 text-xs mb-3">{lea.description}</p>
        <p className="text-gray-500 text-xs max-w-[240px]">
          Ask me to create tasks, check things off, start timers, or tell you
          what's next.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto pb-4 scrollbar-thin scrollbar-thumb-base-700 scrollbar-track-transparent"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex mb-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Lea's avatar for assistant messages */}
            {message.role === 'assistant' && (
              <div className="w-8 h-8 mr-2 shrink-0 mt-1">
                <img
                  src={lea.image}
                  alt={lea.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-neon-cyan/30 text-white rounded-br-md border border-neon-cyan/40'
                  : 'bg-base-800 text-gray-200 rounded-bl-md border border-base-700'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
              {message.functionCalls && message.functionCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-base-700/50">
                  {message.functionCalls.map((call, idx) => (
                    <div
                      key={idx}
                      className={`text-xs flex items-center gap-1 ${
                        call.success ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      <span>{call.success ? '✓' : '✗'}</span>
                      <span className="opacity-75">{call.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start mb-3"
        >
          <div className="w-8 h-8 mr-2 shrink-0 mt-1">
            <img
              src={lea.image}
              alt={lea.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="bg-base-800 text-gray-400 px-4 py-3 rounded-2xl rounded-bl-md border border-base-700">
            <div className="flex items-center gap-1">
              <span
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
