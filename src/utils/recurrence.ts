export type RecurrenceType = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceConfig {
  type: RecurrenceType
  customDays?: number[] // For weekly: 0=Sun..6=Sat. For monthly: day-of-month (1-31). For yearly: [month (0-11), day (1-31)].
}

/**
 * Checks if a recurring task is due on a given day of the week.
 * @param config - The recurrence configuration
 * @param dayOfWeek - 0=Sun, 1=Mon, ..., 6=Sat (matches JS Date.getDay())
 * @returns true if the task is due on that day
 */
export function isDueToday(config: RecurrenceConfig, dayOfWeek: number, dateOfMonth?: number): boolean {
  switch (config.type) {
    case 'daily':
      return true
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case 'weekly':
      if (config.customDays && config.customDays.length > 0) {
        return config.customDays.includes(dayOfWeek)
      }
      return true
    case 'monthly': {
      const today = dateOfMonth ?? new Date().getDate()
      if (config.customDays && config.customDays.length > 0) {
        const anchorDay = config.customDays[0]
        // If anchor day doesn't exist this month (e.g. 31 in Feb), due on last day
        const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
        const effectiveDay = Math.min(anchorDay, lastDay)
        return today === effectiveDay
      }
      return false
    }
    case 'yearly': {
      if (!config.customDays || config.customDays.length < 2) return false
      const [anchorMonth, anchorDate] = config.customDays
      const now = new Date()
      const todayMonth = now.getMonth()
      const todayDate = dateOfMonth ?? now.getDate()
      return todayMonth === anchorMonth && todayDate === anchorDate
    }
    default:
      return false
  }
}

/**
 * Calculates the next reset date for a recurring task based on its config.
 * Returns the start of the next day the task is due (in local time).
 * @param config - The recurrence configuration
 * @param fromDate - The date to calculate from (defaults to now)
 * @returns The next reset Date, or null if no future date can be determined
 */
export function getNextResetDate(config: RecurrenceConfig, fromDate: Date = new Date()): Date | null {
  if (config.type === 'yearly') {
    if (!config.customDays || config.customDays.length < 2) return null
    const [anchorMonth, anchorDate] = config.customDays
    // Try this year, then next year
    for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
      const candidate = new Date(fromDate.getFullYear() + yearOffset, anchorMonth, 1)
      const lastDay = new Date(candidate.getFullYear(), anchorMonth + 1, 0).getDate()
      candidate.setDate(Math.min(anchorDate, lastDay))
      candidate.setHours(0, 0, 0, 0)
      if (candidate > fromDate) return candidate
    }
    return null
  }

  if (config.type === 'monthly') {
    if (!config.customDays || config.customDays.length === 0) return null
    const anchorDay = config.customDays[0]
    // Try this month first, then next month
    for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
      const candidate = new Date(fromDate.getFullYear(), fromDate.getMonth() + monthOffset, 1)
      const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
      const effectiveDay = Math.min(anchorDay, lastDay)
      candidate.setDate(effectiveDay)
      candidate.setHours(0, 0, 0, 0)
      if (candidate > fromDate) return candidate
    }
    // Fallback: 2 months out
    const fallback = new Date(fromDate.getFullYear(), fromDate.getMonth() + 2, 1)
    const lastDay = new Date(fallback.getFullYear(), fallback.getMonth() + 1, 0).getDate()
    fallback.setDate(Math.min(anchorDay, lastDay))
    fallback.setHours(0, 0, 0, 0)
    return fallback
  }

  // Try the next 7 days to find the next due date
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(fromDate)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(0, 0, 0, 0)
    const day = candidate.getDay()
    if (isDueToday(config, day)) {
      return candidate
    }
  }
  return null
}


/**
 * Pure function: resets sub-task completion states for a recurring task.
 * Returns new sub-tasks array with all items marked incomplete,
 * and the big task completed flag set to false.
 */
export function resetSubTasks<T extends { completed: boolean }>(
  subTasks: T[]
): T[] {
  return subTasks.map((st) => ({ ...st, completed: false }))
}

/**
 * Pure function: calculates the new streak value after a recurrence cycle.
 * @param currentStreak - The current streak count
 * @param wasCompletedBeforeReset - Whether all sub-tasks were completed before the reset
 * @returns The new streak value
 */
export function calculateStreakAfterReset(
  currentStreak: number,
  wasCompletedBeforeReset: boolean
): number {
  return wasCompletedBeforeReset ? currentStreak + 1 : 0
}

/**
 * Pure function: removes recurrence from a task, preserving sub-task states.
 * Returns the sub-tasks unchanged (states preserved).
 */
export function removeRecurrencePreserveState<T>(subTasks: T[]): T[] {
  return [...subTasks]
}
