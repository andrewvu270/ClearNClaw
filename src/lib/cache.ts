const CACHE_PREFIX = 'atb_cache_'
const CACHE_VERSION_KEY = 'atb_cache_version'
const CURRENT_VERSION = '1'

/**
 * Simple localStorage cache with versioning.
 * Stores fetched data to avoid repeated Supabase egress.
 */
export function getCached<T>(key: string): T | null {
  try {
    const version = localStorage.getItem(CACHE_VERSION_KEY)
    if (version !== CURRENT_VERSION) {
      clearCache()
      return null
    }
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, expiry } = JSON.parse(raw)
    if (expiry && Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data as T
  } catch {
    return null
  }
}

/**
 * Cache data in localStorage with an optional TTL in milliseconds.
 * Default TTL: 24 hours.
 */
export function setCache<T>(key: string, data: T, ttlMs: number = 24 * 60 * 60 * 1000): void {
  try {
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION)
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, expiry: Date.now() + ttlMs })
    )
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function clearCache(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
  localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION)
}
