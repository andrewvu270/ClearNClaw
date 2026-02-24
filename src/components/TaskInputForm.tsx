import { useState, useRef, useEffect } from 'react'
import { isValidTaskDescription } from '../utils/validation'

interface TaskInputFormProps {
  onSubmit: (description: string) => void
  loading?: boolean
}

// Check Web Speech API support
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
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
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

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.start()
    setListening(true)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSubmit() }}
          placeholder="What's the big task?"
          disabled={loading}
          className="flex-1 bg-base-800 text-white text-sm px-4 py-3 rounded-xl border border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600 disabled:opacity-50"
          aria-label="Task description"
          aria-invalid={!!error}
        />
        {speechSupported && (
          <button
            onClick={handleVoiceInput}
            disabled={loading}
            className={`min-w-[44px] min-h-[44px] rounded-xl border transition-colors flex items-center justify-center ${
              listening
                ? 'bg-neon-pink/20 border-neon-pink text-neon-pink animate-pulse'
                : 'bg-base-800 border-base-700 text-gray-400 hover:text-neon-cyan hover:border-neon-cyan/30'
            } disabled:opacity-50`}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          >
            🎤
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="min-w-[44px] min-h-[44px] px-4 bg-neon-cyan/20 text-neon-cyan font-pixel text-xs rounded-xl border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors disabled:opacity-50"
          aria-label="Submit task"
        >
          {loading ? '...' : 'Go'}
        </button>
      </div>
      {error && (
        <p className="text-neon-pink text-xs px-1" role="alert">{error}</p>
      )}
    </div>
  )
}
