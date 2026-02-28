import { supabase } from '../lib/supabase'
import type { UserProfile, UserToy } from '../types'
import { createDemoTaskIfNeeded } from './taskService'

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, coins, completed_tasks, slip_rate_reduction, last_rewarded_milestone')
    .eq('id', userId)
    .single()

  if (error) throw error

  return {
    id: data.id as string,
    coins: data.coins as number,
    completedTasks: data.completed_tasks as number,
    slipRateReduction: (data.slip_rate_reduction as number) ?? 0,
    lastRewardedMilestone: (data.last_rewarded_milestone as number) ?? 0,
  }
}

/**
 * Ensures a profile exists for the given user. Creates one if missing.
 * Also creates a demo task for new users with zero tasks.
 */
export async function ensureProfile(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('id, coins, completed_tasks, slip_rate_reduction, last_rewarded_milestone')
    .eq('id', userId)
    .single()

  if (data) {
    // Existing user - check if they need a demo task
    await createDemoTaskIfNeeded(userId)
    return {
      id: data.id as string,
      coins: data.coins as number,
      completedTasks: data.completed_tasks as number,
      slipRateReduction: (data.slip_rate_reduction as number) ?? 0,
      lastRewardedMilestone: (data.last_rewarded_milestone as number) ?? 0,
    }
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select('id, coins, completed_tasks, slip_rate_reduction, last_rewarded_milestone')
    .single()

  if (error || !newProfile) throw error ?? new Error('Failed to create profile')

  // New user - create demo task
  await createDemoTaskIfNeeded(userId)

  return {
    id: newProfile.id as string,
    coins: newProfile.coins as number,
    completedTasks: newProfile.completed_tasks as number,
    slipRateReduction: (newProfile.slip_rate_reduction as number) ?? 0,
    lastRewardedMilestone: (newProfile.last_rewarded_milestone as number) ?? 0,
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
