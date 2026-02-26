import { useState, useRef, useEffect } from 'react'
import type { SubTask } from '../types'

interface SubTaskItemProps {
  subTask: SubTask
  onToggle: (subTaskId: string, completed: boolean) => void
  onEditName: (subTaskId: string, name: string) => void
  onEditEmoji?: (subTaskId: string, emoji: string) => void
  onDelete: (subTaskId: string) => void
  readOnly?: boolean
  hideCheckbox?: boolean
}

export function SubTaskItem({ subTask, onToggle, onEditName, onEditEmoji, onDelete, readOnly, hideCheckbox }: SubTaskItemProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(subTask.name)
  const [editingEmoji, setEditingEmoji] = useState(false)
  const [emojiValue, setEmojiValue] = useState(subTask.emoji)
  const emojiInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEmojiValue(subTask.emoji) }, [subTask.emoji])

  const handleSave = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== subTask.name) {
      onEditName(subTask.id, trimmed)
    } else {
      setEditValue(subTask.name)
    }
    setEditing(false)
  }

  const handleEmojiSave = () => {
    const trimmed = emojiValue.trim()
    if (trimmed && trimmed !== subTask.emoji && onEditEmoji) {
      onEditEmoji(subTask.id, trimmed)
    } else {
      setEmojiValue(subTask.emoji)
    }
    setEditingEmoji(false)
  }

  const handleEmojiClick = () => {
    if (readOnly || !onEditEmoji) return
    setEditingEmoji(true)
    setTimeout(() => emojiInputRef.current?.focus(), 0)
  }

  return (
    <div className="flex items-center gap-2 group min-h-[48px]">
      {/* Emoji with background circle */}
      {editingEmoji && !readOnly ? (
        <input
          ref={emojiInputRef}
          value={emojiValue}
          onChange={e => setEmojiValue(e.target.value)}
          onBlur={handleEmojiSave}
          onKeyDown={e => { if (e.key === 'Enter') handleEmojiSave() }}
          className="w-10 h-10 text-center text-xl bg-base-800 rounded-full border border-neon-cyan/30 outline-none focus:border-neon-cyan shrink-0"
          maxLength={4}
        />
      ) : (
        <button
          onClick={handleEmojiClick}
          className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-colors ${
            readOnly ? 'cursor-default' : 'hover:brightness-110 active:scale-95'
          }`}
          style={{ backgroundColor: 'rgba(255, 182, 216, 0.68)' }}
          aria-label="Edit emoji"
        >
          <span className="text-xl select-none leading-none">{subTask.emoji}</span>
        </button>
      )}

      {/* Task name */}
      <div className="flex-1 min-w-0">
        {editing && !readOnly ? (
          <input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            className="w-full bg-base-900 text-white text-base px-2 py-1 rounded border border-neon-cyan/30 outline-none focus:border-neon-cyan"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !readOnly && setEditing(true)}
            className={`text-base text-left break-words w-full ${
              subTask.completed ? 'text-gray-500 line-through' : 'text-gray-200'
            } ${readOnly ? 'cursor-default' : ''}`}
          >
            {subTask.name}
          </button>
        )}
      </div>

      {/* Checkbox + Delete grouped closely */}
      <div className="flex items-center gap-0 shrink-0">
        {!hideCheckbox && (
          <button
            onClick={() => !readOnly && onToggle(subTask.id, !subTask.completed)}
            className="w-8 h-8 flex items-center justify-center"
            aria-label={subTask.completed ? 'Mark incomplete' : 'Mark complete'}
            disabled={readOnly}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              subTask.completed
                ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
                : 'border-gray-500'
            }`}>
              {subTask.completed && <span className="text-xs">✓</span>}
            </div>
          </button>
        )}

        {!readOnly && (
          <button
            onClick={() => onDelete(subTask.id)}
            className="w-6 h-8 flex items-center justify-center text-gray-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-neon-pink transition-all"
            aria-label="Delete sub-task"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
