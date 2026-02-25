import { useState, useRef, useEffect } from 'react'
import { isValidTaskDescription } from '../utils/validation'

interface TaskInputFormProps {
  onSubmit: (description: string) => void
  loading?: boolean
}

const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    : null

export function TaskInputForm({ onSubmit, loading = false }: TaskInputFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null)

  const speechSupported = !!SpeechRecognition

  function createRecognition() {
    if (!SpeechRecognition) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    return recognition
  }

  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!isValidTaskDescription(trimmed)) {
      setError('Please enter a task description')
      return
    }
    setError('')
    onSubmit(trimmed)
    setValue('')
    inputRef.current?.focus()
  }

  const handleVoiceInput = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognition = createRecognition()
    if (!recognition) return
    recognitionRef.current = recognition

    recognition.onresult = (event: { results: { transcript: string }[][] }) => {
      const transcript = event.results[0][0].transcript
      setValue(prev => (prev ? prev + ' ' + transcript : transcript))
      setListening(false)
      setError('')
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSubmit() }}
          placeholder="What's the big task?"
          disabled={loading}
          className={`w-full bg-transparent text-white text-sm pl-0 py-2 border-b outline-none placeholder-gray-600 disabled:opacity-50 ${
            speechSupported ? 'pr-20' : 'pr-10'
          } ${error ? 'border-neon-pink' : 'border-base-700 focus:border-neon-cyan/50'}`}
          aria-label="Task description"
          aria-invalid={!!error}
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
          {speechSupported && (
            <button
              onClick={handleVoiceInput}
              disabled={loading}
              className={`min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
                listening
                  ? 'text-neon-pink animate-pulse'
                  : 'text-gray-500 hover:text-neon-cyan'
              } disabled:opacity-50`}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="text-gray-500 hover:text-neon-cyan transition-colors text-lg leading-none min-w-[36px] min-h-[36px] flex items-center justify-center disabled:opacity-50"
            aria-label="Add task"
          >
            {loading ? '...' : '+'}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-neon-pink text-xs" role="alert">{error}</p>
      )}
    </div>
  )
}
