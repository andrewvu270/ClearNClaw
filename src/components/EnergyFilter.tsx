import type { EnergyTag } from '../utils/energyTag'
import { energyTagToEmoji } from '../utils/energyTag'

interface EnergyFilterProps {
  value: EnergyTag | 'all'
  onChange: (filter: EnergyTag | 'all') => void
}

const FILTER_OPTIONS: { value: EnergyTag | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export function EnergyFilter({ value, onChange }: EnergyFilterProps) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {FILTER_OPTIONS.map(({ value: filterValue, label }) => (
        <button
          key={filterValue}
          onClick={() => onChange(filterValue)}
          className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
            value === filterValue
              ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
              : 'bg-base-800/50 text-gray-500 border border-base-700 hover:border-neon-cyan/30 hover:text-gray-400'
          }`}
          aria-label={`Filter by ${label} energy`}
          aria-pressed={value === filterValue}
        >
          {filterValue !== 'all' && (
            <span className="mr-1">{energyTagToEmoji(filterValue as EnergyTag)}</span>
          )}
          {label}
        </button>
      ))}
    </div>
  )
}
