import type { EnergyTag } from '../utils/energyTag'
import { energyTagToEmoji } from '../utils/energyTag'

interface EnergyTagPickerProps {
  value: EnergyTag
  onChange: (tag: EnergyTag) => void
  disabled?: boolean
}

const ENERGY_OPTIONS: { tag: EnergyTag; label: string }[] = [
  { tag: 'low', label: 'Low' },
  { tag: 'medium', label: 'Medium' },
  { tag: 'high', label: 'High' },
]

export function EnergyTagPicker({ value, onChange, disabled = false }: EnergyTagPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Energy:</span>
      <div className="flex gap-1">
        {ENERGY_OPTIONS.map(({ tag, label }) => (
          <button
            key={tag}
            onClick={() => onChange(tag)}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              value === tag
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                : 'bg-base-800/50 text-gray-400 border border-base-700 hover:border-neon-cyan/30 hover:text-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={`${label} energy`}
            aria-pressed={value === tag}
          >
            <span className="mr-1">{energyTagToEmoji(tag)}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
