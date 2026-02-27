import { supabase } from '../lib/supabase'
import type { RecurrenceConfig, RecurrenceType } from '../utils/recurrence'
import { isDueToday, getNextResetDate } from '../utils/recurrence'

export interface RecurrenceInfo {
  id: string
  bigTaskId: string
  type: RecurrenceType
  customDays?: number[]
  streak: number
  lastCompletedAt: string | null
  lastResetAt: string | null
}

function mapRecurrence(row: Record<string, unknown>): RecurrenceInfo {
  return {
    id: row.id as string,
    bigTaskId: row.big_task_id as string,
    type: row.recurrence_type as RecurrenceType,
    customDays: (row.custom_days as number[] | null) ?? undefined,
    streak: (row.streak as number) ?? 0,
    lastCompletedAt: (row.last_completed_at as string) ?? null,
    lastResetAt: (row.last_reset_at as string) ?? null,
  }
}

/**
 * Sets or updates recurrence config for a big task.
 */
export async function setRecurrence(
  bigTaskId: string,
  config: RecurrenceConfig
): Promise<void> {
  const { error } = await supabase
    .from('recurring_tasks')
    .upsert(
      {
        big_task_id: bigTaskId,
        recurrence_type: config.type,
        custom_days: config.customDays ?? null,
        last_reset_at: new Date().toISOString(),
      },
      { onConflict: 'big_task_id' }
    )

  if (error) throw error
}

/**
 * Removes recurrence from a big task, converting it to a standard one-time task.
 */
export async function removeRecurrence(bigTaskId: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_tasks')
    .delete()
    .eq('big_task_id', bigTaskId)

  if (error) throw error
}

/**
 * Gets the recurrence info for a specific big task, if any.
 */
export async function getRecurrence(bigTaskId: string): Promise<RecurrenceInfo | null> {
  const { data, error } = await supabase
    .from('recurring_tasks')
    .select('*')
    .eq('big_task_id', bigTaskId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRecurrence(data)
}


/**
 * Gets all recurring tasks that are due today for a user.
 */
export async function getRecurringTasksDueToday(userId: string): Promise<RecurrenceInfo[]> {
  const { data, error } = await supabase
    .from('recurring_tasks')
    .select('*, big_tasks!inner(user_id)')
    .eq('big_tasks.user_id', userId)

  if (error) throw error

  const today = new Date().getDay()
  const dateOfMonth = new Date().getDate()
  return (data ?? [])
    .map((row: Record<string, unknown>) => mapRecurrence(row))
    .filter((r) =>
      isDueToday({ type: r.type, customDays: r.customDays }, today, dateOfMonth)
    )
}

/**
 * Helper: compute the next reminder_at from the current reminder time + recurrence config.
 * Extracts the time-of-day from the existing reminder_at and finds the next due date.
 */
function computeNextReminderAt(
  currentReminderAt: string,
  config: RecurrenceConfig
): string | null {
  const prev = new Date(currentReminderAt)
  const hours = prev.getHours()
  const minutes = prev.getMinutes()

  const nextDate = getNextResetDate(config, new Date())
  if (!nextDate) return null

  nextDate.setHours(hours, minutes, 0, 0)
  return nextDate.toISOString()
}

/**
 * Checks and resets overdue recurring tasks on app open.
 * - If task was completed since last reset → streak already incremented by RPC
 * - If task was NOT completed since last reset → streak resets to 0
 * - All sub-tasks marked incomplete, big task completion reset
 * - Re-sets reminder_at to the next occurrence if the task had a reminder
 */
export async function checkAndResetRecurringTasks(userId: string): Promise<void> {
  const localToday = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local tz

  const { data: overdue, error } = await supabase
    .from('recurring_tasks')
    .select('*, big_tasks!inner(user_id, reminder_at)')
    .eq('big_tasks.user_id', userId)
    .lt('last_reset_at', localToday)

  if (error) throw error

  for (const rt of overdue ?? []) {
    const wasCompleted =
      rt.last_completed_at && rt.last_reset_at && rt.last_completed_at > rt.last_reset_at

    if (!wasCompleted) {
      await supabase
        .from('recurring_tasks')
        .update({ streak: 0 })
        .eq('id', rt.id)
    }

    // Reset all sub-tasks to incomplete
    await supabase
      .from('sub_tasks')
      .update({ completed: false })
      .eq('big_task_id', rt.big_task_id)

    // Compute next reminder_at if the task had one
    const bigTask = rt.big_tasks as unknown as { reminder_at: string | null }
    const config: RecurrenceConfig = {
      type: rt.recurrence_type as RecurrenceType,
      customDays: (rt.custom_days as number[] | null) ?? undefined,
    }
    const nextReminder = bigTask.reminder_at
      ? computeNextReminderAt(bigTask.reminder_at, config)
      : null

    // Reset big task completion and update reminder
    await supabase
      .from('big_tasks')
      .update({
        completed: false,
        completed_at: null,
        reminder_at: nextReminder,
      })
      .eq('id', rt.big_task_id)

    // Update last_reset_at
    await supabase
      .from('recurring_tasks')
      .update({ last_reset_at: new Date().toISOString() })
      .eq('id', rt.id)
  }
}
