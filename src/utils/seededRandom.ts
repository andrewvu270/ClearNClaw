/**
 * Seeded random number generator using mulberry32
 * Returns a function that generates deterministic random numbers
 */
export function createSeededRandom(seed: string): () => number {
  // Convert string seed to number
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  let state = Math.abs(hash)
  
  return function() {
    state = (state * 1664525 + 1013904223) | 0
    return Math.abs(state) / 0x100000000
  }
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayString(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}
