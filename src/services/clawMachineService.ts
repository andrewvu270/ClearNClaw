import { supabase } from '../lib/supabase'

/**
 * Awards a toy to a user. Increments count if already owned.
 */
export async function awardToy(userId: string, toyId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('user_toys')
    .select('id, count')
    .eq('user_id', userId)
    .eq('toy_id', toyId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('user_toys')
      .update({ count: (existing.count as number) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('user_toys')
      .insert({ user_id: userId, toy_id: toyId })
    if (error) throw error
  }
}
