import { useState, useRef } from 'react'
import { isValidTaskDescription } from '../utils/validation'

interface TaskInputFormProps {
  onSubmit: (description: string) => void
  loading?: boolean
}

export function TaskInputForm({ onSubmit, loading = false }: TaskInputFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-2xl px-4 py-2"
        style={{
          background: 'rgba(10, 22, 40, 0.6)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          border: '1px solid rgba(0, 229, 255, 0.15)',
          boxShadow: '0 0 16px rgba(0, 229, 255, 0.06), 0 2px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSubmit() }}
          placeholder="What's the big task?"
          disabled={loading}
          className="w-full bg-transparent text-white text-base pl-0 pr-10 py-2 border-none outline-none placeholder-gray-400 disabled:opacity-50"
          aria-label="Task description"
          aria-invalid={!!error}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
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
