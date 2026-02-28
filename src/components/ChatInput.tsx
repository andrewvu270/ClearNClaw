import { useState, useCallback, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * ChatInput - Text input with send button for chat messages
 * Requirements: 2.1
 */
export function ChatInput({ onSend, disabled = false, placeholder = "Type a message..." }: ChatInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [value])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    
    onSend(trimmed)
    setValue('')
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="flex items-end gap-2 bg-base-800/80 backdrop-blur-sm border border-base-700 rounded-2xl p-2 safe-area-inset-bottom">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="flex-1 bg-transparent text-white text-base placeholder-gray-500 resize-none outline-none px-3 py-2.5 max-h-[120px] scrollbar-thin scrollbar-thumb-base-700 scrollbar-track-transparent"
        style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
        aria-label="Message input"
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
          canSend
            ? 'bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 active:scale-95'
            : 'bg-base-700/50 text-gray-600 cursor-not-allowed'
        }`}
        aria-label="Send message"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
        </svg>
      </button>
    </div>
  )
}
