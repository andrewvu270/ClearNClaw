import { supabase } from '../lib/supabase'
import type { BigTask, SubTask, RepeatOption } from '../types'
import type { EnergyTag } from '../utils/energyTag'
import { parseEnergyTag } from '../utils/energyTag'

function parseRepeatSchedule(value: unknown): RepeatOption | null {
  if (value === 'daily' || value === 'weekly' || value === 'custom') return value
  return null
}

function mapBigTask(row: Record<string, unknown>, subTasks: SubTask[] = []): BigTask {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    completed: row.completed as boolean,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? null,
    subTasks,
    energyTag: parseEnergyTag(row.energy_tag as string | null),
    reminderAt: (row.reminder_at as string) ?? null,
    repeatSchedule: parseRepeatSchedule(row.repeat_schedule),
  }
}

function mapSubTask(row: Record<string, unknown>): SubTask {
  return {
    id: row.id as string,
    bigTaskId: row.big_task_id as string,
    name: row.name as string,
    emoji: (row.emoji as string) || '▪️',
    completed: row.completed as boolean,
    sortOrder: row.sort_order as number,
  }
}

export async function createBigTask(
  userId: string,
  description: string,
  emoji: string,
  subTaskItems: { name: string; emoji: string }[],
  energyTag: EnergyTag = 'medium'
): Promise<BigTask> {
  const { data: taskRow, error: taskError } = await supabase
    .from('big_tasks')
    .insert({ user_id: userId, name: description, emoji, energy_tag: energyTag })
    .select()
    .single()

  if (taskError || !taskRow) throw taskError ?? new Error('Failed to create big task')

  const subTaskInserts = subTaskItems.map((st, i) => ({
    big_task_id: taskRow.id,
    name: st.name,
    emoji: st.emoji,
    sort_order: i,
  }))

  const { data: subRows, error: subError } = await supabase
    .from('sub_tasks')
    .insert(subTaskInserts)
    .select()

  if (subError) throw subError

  return mapBigTask(taskRow, (subRows ?? []).map(mapSubTask))
}

export async function getBigTasks(userId: string, completed: boolean): Promise<BigTask[]> {
  const { data: tasks, error } = await supabase
    .from('big_tasks')
    .select('*, sub_tasks(*)')
    .eq('user_id', userId)
    .eq('completed', completed)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (tasks ?? []).map(row => {
    const subTasks = ((row.sub_tasks as Record<string, unknown>[]) ?? [])
      .map(mapSubTask)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return mapBigTask(row, subTasks)
  })
}

export async function updateBigTaskName(taskId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('big_tasks')
    .update({ name })
    .eq('id', taskId)

  if (error) throw error
}

export async function updateBigTaskEmoji(taskId: string, emoji: string): Promise<void> {
  const { error } = await supabase
    .from('big_tasks')
    .update({ emoji })
    .eq('id', taskId)

  if (error) throw error
}

export async function updateBigTaskEnergyTag(taskId: string, energyTag: EnergyTag): Promise<void> {
  const { error } = await supabase
    .from('big_tasks')
    .update({ energy_tag: energyTag })
    .eq('id', taskId)

  if (error) throw error
}

export async function deleteBigTask(taskId: string): Promise<void> {
  // sub_tasks cascade on delete via FK constraint
  const { error } = await supabase
    .from('big_tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw error
}

export async function toggleSubTask(
  subTaskId: string,
  completed: boolean,
  userId: string
): Promise<void> {
  if (completed) {
    // Use RPC for atomic completion + coin award check
    const { error } = await supabase.rpc('complete_subtask_and_check', {
      p_subtask_id: subTaskId,
      p_user_id: userId,
    })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('sub_tasks')
      .update({ completed: false })
      .eq('id', subTaskId)
    if (error) throw error
  }
}

export async function updateSubTaskName(subTaskId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('sub_tasks')
    .update({ name })
    .eq('id', subTaskId)

  if (error) throw error
}

export async function updateSubTaskEmoji(subTaskId: string, emoji: string): Promise<void> {
  const { error } = await supabase
    .from('sub_tasks')
    .update({ emoji })
    .eq('id', subTaskId)

  if (error) throw error
}

export async function deleteSubTask(subTaskId: string): Promise<void> {
  const { error } = await supabase
    .from('sub_tasks')
    .delete()
    .eq('id', subTaskId)

  if (error) throw error
}

export async function updateBigTaskReminder(taskId: string, reminderAt: string | null): Promise<void> {
  const { error } = await supabase
    .from('big_tasks')
    .update({ reminder_at: reminderAt })
    .eq('id', taskId)

  if (error) throw error
}

export async function updateBigTaskRepeatSchedule(taskId: string, repeatSchedule: string | null): Promise<void> {
  const { error } = await supabase
    .from('big_tasks')
    .update({ repeat_schedule: repeatSchedule })
    .eq('id', taskId)

  if (error) throw error
}

export async function addSubTask(bigTaskId: string, name: string): Promise<SubTask> {
  // Get current max sort_order
  const { data: existing } = await supabase
    .from('sub_tasks')
    .select('sort_order')
    .eq('big_task_id', bigTaskId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0

  const { data, error } = await supabase
    .from('sub_tasks')
    .insert({ big_task_id: bigTaskId, name, emoji: '▪️', sort_order: nextOrder })
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to add sub-task')

  return mapSubTask(data)
}

/**
 * Creates a demo task for new users if they have zero big tasks.
 * Called from ensureProfile to provide immediate onboarding experience.
 */
export async function createDemoTaskIfNeeded(userId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('big_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) throw countError

  if (count === 0) {
    await createBigTask(
      userId,
      '🎮 Build Your First Win',
      '🎮',
      [
        { name: 'Press Start', emoji: '▶️' },
        { name: 'Complete 1 action', emoji: '✅' },
        { name: 'Win your first coin', emoji: '🪙' },
        { name: 'Play claw machine', emoji: '🕹️' },
      ],
      'low'
    )
  }
}

/**
 * Quick complete a big task by marking all incomplete subtasks as complete.
 * This triggers the same completion flow as completing subtasks individually,
 * including coin rewards via the RPC.
 */
export async function quickCompleteTask(taskId: string, userId: string): Promise<void> {
  // Get the task with all its subtasks
  const { data: taskData, error: fetchError } = await supabase
    .from('big_tasks')
    .select('*, sub_tasks(*)')
    .eq('id', taskId)
    .single()

  if (fetchError || !taskData) {
    throw fetchError ?? new Error('Task not found')
  }

  const subTasks = ((taskData.sub_tasks as Record<string, unknown>[]) ?? []).map(mapSubTask)
  const incompleteSubTasks = subTasks.filter(st => !st.completed)

  // Complete each incomplete subtask
  // The last one will trigger the RPC that awards coins and marks the big task complete
  for (const subTask of incompleteSubTasks) {
    await toggleSubTask(subTask.id, true, userId)
  }
}
