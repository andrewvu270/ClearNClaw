import { supabase } from '../lib/supabase'

export async function getCoinBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('coins')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data.coins as number
}

/**
 * Deducts 1 coin. Returns false if balance is 0.
 */
export async function spendCoin(userId: string): Promise<boolean> {
  const balance = await getCoinBalance(userId)
  if (balance <= 0) return false

  const { error } = await supabase
    .from('profiles')
    .update({ coins: balance - 1 })
    .eq('id', userId)

  if (error) throw error
  return true
}

export async function awardCoin(userId: string): Promise<void> {
  const balance = await getCoinBalance(userId)

  const { error } = await supabase
    .from('profiles')
    .update({ coins: balance + 1 })
    .eq('id', userId)

  if (error) throw error
}
