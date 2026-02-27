import { useState } from 'react'
import type { RecurrenceType, RecurrenceConfig as RecurrenceConfigType } from '../utils/recurrence'

interface RecurrenceConfigProps {
  value: RecurrenceConfigType | null
  onChange: (config: RecurrenceConfigType | null) => void
  disabled?: boolean
}

const SCHEDULE_OPTIONS: { type: RecurrenceType; label: string }[] = [
  { type: 'daily', label: 'Daily' },
  { type: 'weekdays', label: 'Weekdays' },
  { type: 'weekly', label: 'Weekly' },
  { type: 'monthly', label: 'Monthly' },
  { type: 'yearly', label: 'Yearly' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function RecurrenceConfig({ value, onChange, disabled = false }: RecurrenceConfigProps) {
  const [isRecurring, setIsRecurring] = useState(value !== null)

  const handleToggle = () => {
    if (isRecurring) {
      setIsRecurring(false)
      onChange(null)
    } else {
      setIsRecurring(true)
      onChange({ type: 'daily' })
    }
  }

  const handleTypeChange = (type: RecurrenceType) => {
    const base: RecurrenceConfigType = { type }
    if (type === 'weekly') {
      base.customDays = [new Date().getDay()]
    } else if (type === 'monthly') {
      base.customDays = [new Date().getDate()]
    } else if (type === 'yearly') {
      base.customDays = [new Date().getMonth(), new Date().getDate()] // [month, day]
    }
    onChange(base)
  }

  const handleDayToggle = (day: number) => {
    const current = value?.customDays ?? []
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort()
    onChange({ ...value!, customDays: updated })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔁</span>
          <span className="text-gray-200 font-medium">Repeat</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            isRecurring ? 'bg-neon-cyan' : 'bg-gray-600'
          } disabled:opacity-50`}
          role="switch"
          aria-checked={isRecurring}
          aria-label="Toggle repeat"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
              isRecurring ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isRecurring && value && (
        <div className="space-y-3 ml-8">
          {/* Schedule type picker */}
          <div className="flex gap-1 flex-wrap">
            {SCHEDULE_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                disabled={disabled}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  value.type === type
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                    : 'bg-base-800/50 text-gray-400 border border-base-700 hover:border-neon-cyan/30'
                } disabled:opacity-50`}
                aria-pressed={value.type === type}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Day picker for weekly */}
          {value.type === 'weekly' && (
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayToggle(i)}
                  disabled={disabled}
                  className={`w-8 h-8 rounded-full text-xs transition-all ${
                    (value.customDays ?? []).includes(i)
                      ? 'bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50'
                      : 'bg-base-800/50 text-gray-500 border border-base-700 hover:border-neon-cyan/30'
                  } disabled:opacity-50`}
                  aria-label={label}
                  aria-pressed={(value.customDays ?? []).includes(i)}
                >
                  {label.charAt(0)}
                </button>
              ))}
            </div>
          )}

          {/* Monthly anchor display */}
          {value.type === 'monthly' && value.customDays && value.customDays[0] && (
            <p className="text-xs text-gray-400">
              Repeats on the {ordinal(value.customDays[0])} of each month
            </p>
          )}

          {/* Yearly anchor display */}
          {value.type === 'yearly' && value.customDays && value.customDays.length >= 2 && (
            <p className="text-xs text-gray-400">
              Repeats every {MONTH_LABELS[value.customDays[0]]} {ordinal(value.customDays[1])}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
