import { useState } from 'react'

interface DurationPickerProps {
  onConfirm: (durationMs: number) => void
  onCancel: () => void
}

const PRESET_DURATIONS = [
  { label: '2', minutes: 2 },
  { label: '5', minutes: 5 },
  { label: '10', minutes: 10 },
  { label: '15', minutes: 15 },
  { label: '25', minutes: 25 },
  { label: '45', minutes: 45 },
  { label: '60', minutes: 60 },
]

export function DurationPicker({ onConfirm, onCancel }: DurationPickerProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [customInput, setCustomInput] = useState('')

  const handlePresetClick = (minutes: number) => {
    setSelectedMinutes(minutes)
    setCustomInput('')
  }

  const handleCustomInputChange = (value: string) => {
    setCustomInput(value)
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) {
      // Clamp to 1-120 range
      const clamped = Math.max(1, Math.min(120, parsed))
      setSelectedMinutes(clamped)
    }
  }

  const handleConfirm = () => {
    const durationMs = selectedMinutes * 60 * 1000
    onConfirm(durationMs)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-base-800 border border-base-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl text-white mb-4">Set Timer (minutes)</h2>
        
        {/* Preset buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PRESET_DURATIONS.map(({ label, minutes }) => (
            <button
              key={minutes}
              onClick={() => handlePresetClick(minutes)}
              className={`py-3 px-3 rounded text-lg transition-colors ${
                selectedMinutes === minutes && !customInput
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan'
                  : 'bg-base-700 text-gray-300 hover:bg-base-600 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Custom (1-120 min)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={customInput}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            placeholder="Enter minutes"
            className="w-full bg-base-700 text-white px-3 py-2 rounded border border-base-600 focus:border-neon-cyan focus:outline-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 bg-base-700 text-gray-300 rounded hover:bg-base-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 px-4 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan rounded hover:bg-neon-cyan/30 transition-colors"
          >
            Start Timer
          </button>
        </div>
      </div>
    </div>
  )
}
