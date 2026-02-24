import { supabase } from '../lib/supabase'
import { getCached, setCache } from '../lib/cache'
import type { Toy } from '../types'

const TOYS_CACHE_KEY = 'toys'

function mapToy(row: Record<string, unknown>): Toy {
  return {
    id: row.id as string,
    name: row.name as string,
    group: (row.group as string) ?? null,
    width: row.width as number,
    height: row.height as number,
    spriteNormal: (row.sprite_normal as string) ?? null,
    spriteGrabbed: (row.sprite_grabbed as string) ?? null,
    spriteCollected: (row.sprite_collected as string) ?? null,
    spriteWidth: (row.sprite_width as number) ?? null,
    spriteHeight: (row.sprite_height as number) ?? null,
    spriteTop: (row.sprite_top as number) ?? null,
    spriteLeft: (row.sprite_left as number) ?? null,
    mimeType: (row.mime_type as string) ?? null,
  }
}

/**
 * Fetches all available toys, using localStorage cache to avoid
 * repeated egress of base64 sprite data.
 * Cache TTL: 24 hours.
 */
export async function getAvailableToys(): Promise<Toy[]> {
  const cached = getCached<Toy[]>(TOYS_CACHE_KEY)
  if (cached) return cached

  const { data, error } = await supabase
    .from('toys')
    .select('*')

  if (error) throw error

  const toys = (data ?? []).map(mapToy)
  setCache(TOYS_CACHE_KEY, toys)
  return toys
}

export async function awardToy(userId: string, toyId: string): Promise<void> {
  // Check if user already has this toy
  const { data: existing } = await supabase
    .from('user_toys')
    .select('id, count')
    .eq('user_id', userId)
    .eq('toy_id', toyId)
    .single()

  if (existing) {
    // Increment count
    const { error } = await supabase
      .from('user_toys')
      .update({ count: (existing.count as number) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    // Insert new entry
    const { error } = await supabase
      .from('user_toys')
      .insert({ user_id: userId, toy_id: toyId })
    if (error) throw error
  }
}
