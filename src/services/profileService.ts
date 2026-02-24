import { supabase } from '../lib/supabase'
import type { UserProfile, UserToy } from '../types'

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, coins, completed_tasks')
    .eq('id', userId)
    .single()

  if (error) throw error

  return {
    id: data.id as string,
    coins: data.coins as number,
    completedTasks: data.completed_tasks as number,
  }
}

/**
 * Ensures a profile exists for the given user. Creates one if missing.
 */
export async function ensureProfile(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('id, coins, completed_tasks')
    .eq('id', userId)
    .single()

  if (data) {
    return {
      id: data.id as string,
      coins: data.coins as number,
      completedTasks: data.completed_tasks as number,
    }
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select('id, coins, completed_tasks')
    .single()

  if (error || !newProfile) throw error ?? new Error('Failed to create profile')

  return {
    id: newProfile.id as string,
    coins: newProfile.coins as number,
    completedTasks: newProfile.completed_tasks as number,
  }
}

export async function getToyCollection(userId: string): Promise<UserToy[]> {
  const { data, error } = await supabase
    .from('user_toys')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(row => ({
    id: row.id as string,
    userId: row.user_id as string,
    toyId: row.toy_id as string,
    count: row.count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
}
