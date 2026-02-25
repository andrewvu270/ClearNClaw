export type EnergyTag = 'high' | 'medium' | 'low'

const ENERGY_CONFIG = {
  high: { emoji: '🌳', coins: 3, label: 'High Energy' },
  medium: { emoji: '🌿', coins: 2, label: 'Medium Energy' },
  low: { emoji: '🌱', coins: 1, label: 'Low Energy' },
} as const

export function energyTagToEmoji(tag: EnergyTag): string {
  return ENERGY_CONFIG[tag].emoji
}

export function energyTagToCoins(tag: EnergyTag): number {
  return ENERGY_CONFIG[tag].coins
}

export function parseEnergyTag(value: string | null | undefined): EnergyTag {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}
