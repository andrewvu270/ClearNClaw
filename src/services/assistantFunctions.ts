import type { BigTask, SubTask } from '../types'
import type { FunctionCall, FunctionResult, TimerState } from '../types/assistant'
import {
  createBigTask,
  getBigTasks,
  updateBigTaskName,
  deleteBigTask,
  toggleSubTask,
  updateSubTaskName,
  deleteSubTask,
  updateBigTaskReminder,
  addSubTask as addSubTaskService,
  clearCompletedTasks as clearCompletedTasksService,
} from './taskService'
import { breakDownTask } from './agentService'
import { setRecurrence as setRecurrenceService } from './recurrenceService'
import type { RecurrenceType } from '../utils/recurrence'

/**
 * Timer control interface - to be injected from FocusTimerContext
 */
export interface TimerController {
  start: (durationMs: number) => void
  stop: () => void
  pause: () => void
  resume: () => void
  getState: () => TimerState | null
  setActiveTask: (task: BigTask | null) => void
}

/**
 * Context for function execution
 */
export interface FunctionContext {
  userId: string
  tasks: BigTask[]
  timerController?: TimerController
}

/**
 * Find a task by name (case-insensitive partial match)
 */
export function findTaskByName(tasks: BigTask[], name: string): BigTask[] {
  const lowerName = name.toLowerCase().trim()
  return tasks.filter((t) => t.name.toLowerCase().includes(lowerName))
}

/**
 * Find a subtask by name across all tasks (case-insensitive partial match)
 */
export function findSubtaskByName(
  tasks: BigTask[],
  name: string
): { task: BigTask; subtask: SubTask }[] {
  const lowerName = name.toLowerCase().trim()
  const results: { task: BigTask; subtask: SubTask }[] = []

  for (const task of tasks) {
    for (const subtask of task.subTasks) {
      if (subtask.name.toLowerCase().includes(lowerName)) {
        results.push({ task, subtask })
      }
    }
  }

  return results
}

/**
 * Create a new task with AI-generated subtasks
 */
export async function createTask(
  ctx: FunctionContext,
  description: string,
  confirmed: boolean
): Promise<FunctionResult> {
  if (!confirmed) {
    return {
      success: false,
      message: `Should I create a task called "${description}"? Please confirm.`,
    }
  }

  try {
    const breakdown = await breakDownTask(description)
    const newTask = await createBigTask(
      ctx.userId,
      description,
      breakdown.emoji,
      breakdown.subTasks,
      breakdown.energyTag
    )

    const subtaskNames = newTask.subTasks.map((st) => st.name).join(', ')
    return {
      success: true,
      data: newTask,
      message: `Created task "${newTask.name}" with ${newTask.subTasks.length} subtasks: ${subtaskNames}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to create task. Please try again.',
    }
  }
}


/**
 * Complete a BigTask by name
 */
export async function completeTask(
  ctx: FunctionContext,
  taskName: string
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  // Check if all subtasks are completed
  const incompleteSubtasks = task.subTasks.filter((st) => !st.completed)
  if (incompleteSubtasks.length > 0) {
    return {
      success: false,
      message: `Task "${task.name}" still has ${incompleteSubtasks.length} incomplete subtasks. Complete them first or mark them individually.`,
    }
  }

  // All subtasks done - the task should already be marked complete by the RPC
  // But we can confirm the state
  return {
    success: true,
    data: task,
    message: `Task "${task.name}" is complete! Great job!`,
  }
}

/**
 * Complete a subtask by name (uses existing completion flow for coin awarding)
 */
export async function completeSubtask(
  ctx: FunctionContext,
  subtaskName: string
): Promise<FunctionResult> {
  const matches = findSubtaskByName(ctx.tasks, subtaskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a subtask called "${subtaskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((m) => `"${m.subtask.name}" (in ${m.task.name})`).join(', ')
    return {
      success: false,
      message: `I found multiple subtasks matching "${subtaskName}": ${names}. Which one did you mean?`,
    }
  }

  const { task, subtask } = matches[0]

  if (subtask.completed) {
    return {
      success: true,
      data: subtask,
      message: `Subtask "${subtask.name}" is already completed.`,
    }
  }

  try {
    // Use toggleSubTask which goes through the RPC for coin awarding
    await toggleSubTask(subtask.id, true, ctx.userId)

    return {
      success: true,
      data: subtask,
      message: `Completed subtask "${subtask.name}" in task "${task.name}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to complete subtask. Please try again.',
    }
  }
}

/**
 * Rename a BigTask
 */
export async function renameTask(
  ctx: FunctionContext,
  oldName: string,
  newName: string
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, oldName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${oldName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${oldName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  try {
    await updateBigTaskName(task.id, newName)
    return {
      success: true,
      data: { oldName: task.name, newName },
      message: `Renamed task from "${task.name}" to "${newName}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to rename task. Please try again.',
    }
  }
}

/**
 * Rename a subtask
 */
export async function renameSubtask(
  ctx: FunctionContext,
  oldName: string,
  newName: string
): Promise<FunctionResult> {
  const matches = findSubtaskByName(ctx.tasks, oldName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a subtask called "${oldName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((m) => `"${m.subtask.name}" (in ${m.task.name})`).join(', ')
    return {
      success: false,
      message: `I found multiple subtasks matching "${oldName}": ${names}. Which one did you mean?`,
    }
  }

  const { task, subtask } = matches[0]

  try {
    await updateSubTaskName(subtask.id, newName)
    return {
      success: true,
      data: { oldName: subtask.name, newName },
      message: `Renamed subtask from "${subtask.name}" to "${newName}" in task "${task.name}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to rename subtask. Please try again.',
    }
  }
}


/**
 * Add a subtask to a task
 */
export async function addSubtask(
  ctx: FunctionContext,
  taskName: string,
  subtaskDescription: string
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  try {
    const newSubtask = await addSubTaskService(task.id, subtaskDescription)
    return {
      success: true,
      data: newSubtask,
      message: `Added subtask "${subtaskDescription}" to task "${task.name}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to add subtask. Please try again.',
    }
  }
}

/**
 * Remove a subtask
 */
export async function removeSubtask(
  ctx: FunctionContext,
  subtaskName: string
): Promise<FunctionResult> {
  const matches = findSubtaskByName(ctx.tasks, subtaskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a subtask called "${subtaskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((m) => `"${m.subtask.name}" (in ${m.task.name})`).join(', ')
    return {
      success: false,
      message: `I found multiple subtasks matching "${subtaskName}": ${names}. Which one did you mean?`,
    }
  }

  const { task, subtask } = matches[0]

  try {
    await deleteSubTask(subtask.id)
    return {
      success: true,
      data: subtask,
      message: `Removed subtask "${subtask.name}" from task "${task.name}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to remove subtask. Please try again.',
    }
  }
}

/**
 * Delete a BigTask (requires confirmation)
 */
export async function deleteTask(
  ctx: FunctionContext,
  taskName: string,
  confirmed: boolean
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  if (!confirmed) {
    return {
      success: false,
      message: `Are you sure you want to delete task "${task.name}"? This cannot be undone. Please confirm.`,
    }
  }

  try {
    await deleteBigTask(task.id)
    return {
      success: true,
      data: { deletedTask: task.name },
      message: `Deleted task "${task.name}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to delete task. Please try again.',
    }
  }
}

/**
 * Clear all completed tasks (requires confirmation)
 */
export async function clearCompletedTasks(
  ctx: FunctionContext,
  confirmed: boolean
): Promise<FunctionResult> {
  try {
    // Get completed tasks count first
    const completedTasks = await getBigTasks(ctx.userId, true)
    const count = completedTasks.length

    if (count === 0) {
      return {
        success: true,
        data: { count: 0 },
        message: 'No completed tasks to clear.',
      }
    }

    if (!confirmed) {
      return {
        success: false,
        message: `Are you sure you want to delete ${count} completed task${count > 1 ? 's' : ''}? This cannot be undone. Please confirm.`,
      }
    }

    await clearCompletedTasksService(ctx.userId)
    return {
      success: true,
      data: { count },
      message: `Cleared ${count} completed task${count > 1 ? 's' : ''}.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to clear completed tasks. Please try again.',
    }
  }
}


/**
 * Set a reminder for a task
 */
export async function setReminder(
  ctx: FunctionContext,
  taskName: string,
  time: string
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  try {
    // Parse the time string - support various formats
    const reminderDate = parseTimeString(time)
    if (!reminderDate) {
      return {
        success: false,
        message: `I couldn't understand the time "${time}". Try something like "3pm", "15:00", or "in 2 hours".`,
      }
    }

    await updateBigTaskReminder(task.id, reminderDate.toISOString())
    return {
      success: true,
      data: { taskName: task.name, reminderAt: reminderDate.toISOString() },
      message: `Set reminder for "${task.name}" at ${reminderDate.toLocaleTimeString()}.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to set reminder. Please try again.',
    }
  }
}

/**
 * Remove a reminder from a task
 */
export async function removeReminder(
  ctx: FunctionContext,
  taskName: string
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  try {
    await updateBigTaskReminder(task.id, null)
    return {
      success: true,
      data: { taskName: task.name },
      message: `Removed reminder from "${task.name}".`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to remove reminder. Please try again.',
    }
  }
}

/**
 * Set recurrence for a task
 */
export async function setRecurrence(
  ctx: FunctionContext,
  taskName: string,
  frequency: string
): Promise<FunctionResult> {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]

  try {
    const recurrenceType = parseRecurrenceFrequency(frequency)
    if (!recurrenceType) {
      return {
        success: false,
        message: `I couldn't understand the frequency "${frequency}". Try "daily", "weekdays", "weekends", "weekly", or "monthly".`,
      }
    }

    await setRecurrenceService(task.id, { type: recurrenceType })
    return {
      success: true,
      data: { taskName: task.name, frequency: recurrenceType },
      message: `Set "${task.name}" to repeat ${recurrenceType}.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to set recurrence. Please try again.',
    }
  }
}

/**
 * Parse a time string into a Date object
 */
function parseTimeString(time: string): Date | null {
  const now = new Date()
  const lowerTime = time.toLowerCase().trim()

  // Handle "in X hours/minutes" format
  const inMatch = lowerTime.match(/^in\s+(\d+)\s+(hour|minute|min|hr)s?$/i)
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10)
    const unit = inMatch[2].toLowerCase()
    const result = new Date(now)
    if (unit.startsWith('hour') || unit === 'hr') {
      result.setHours(result.getHours() + amount)
    } else {
      result.setMinutes(result.getMinutes() + amount)
    }
    return result
  }

  // Handle "Xpm" or "Xam" format
  const ampmMatch = lowerTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10)
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0
    const isPm = ampmMatch[3].toLowerCase() === 'pm'

    if (isPm && hours !== 12) hours += 12
    if (!isPm && hours === 12) hours = 0

    const result = new Date(now)
    result.setHours(hours, minutes, 0, 0)

    // If the time is in the past, assume tomorrow
    if (result <= now) {
      result.setDate(result.getDate() + 1)
    }
    return result
  }

  // Handle "HH:MM" 24-hour format
  const timeMatch = lowerTime.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const result = new Date(now)
      result.setHours(hours, minutes, 0, 0)

      // If the time is in the past, assume tomorrow
      if (result <= now) {
        result.setDate(result.getDate() + 1)
      }
      return result
    }
  }

  return null
}

/**
 * Parse a recurrence frequency string into a RecurrenceType
 */
function parseRecurrenceFrequency(frequency: string): RecurrenceType | null {
  const lower = frequency.toLowerCase().trim()

  if (lower === 'daily' || lower === 'every day') return 'daily'
  if (lower === 'weekdays' || lower === 'on weekdays') return 'weekdays'
  if (lower === 'weekly' || lower === 'every week') return 'weekly'
  if (lower === 'monthly' || lower === 'every month') return 'monthly'
  if (lower === 'yearly' || lower === 'every year') return 'yearly'

  return null
}


/**
 * Start a focus timer
 */
export function startTimer(
  ctx: FunctionContext,
  duration?: number,
  taskName?: string
): FunctionResult {
  if (!ctx.timerController) {
    return {
      success: false,
      message: 'Timer is not available right now.',
    }
  }

  const currentState = ctx.timerController.getState()
  if (currentState && (currentState.isRunning || currentState.isPaused)) {
    return {
      success: false,
      message: 'A timer is already running. Stop it first or pause it.',
    }
  }

  // Default to 25 minutes if no duration specified
  const durationMs = (duration ?? 25) * 60 * 1000

  // If task name provided, find and set it as active
  if (taskName) {
    const matches = findTaskByName(ctx.tasks, taskName)
    if (matches.length === 1) {
      ctx.timerController.setActiveTask(matches[0])
    } else if (matches.length > 1) {
      const names = matches.map((t) => t.name).join(', ')
      return {
        success: false,
        message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
      }
    }
  }

  ctx.timerController.start(durationMs)

  const minutes = Math.round(durationMs / 60000)
  return {
    success: true,
    data: { duration: minutes },
    message: `Started a ${minutes} minute timer.`,
  }
}

/**
 * Pause the focus timer
 */
export function pauseTimer(ctx: FunctionContext): FunctionResult {
  if (!ctx.timerController) {
    return {
      success: false,
      message: 'Timer is not available right now.',
    }
  }

  const currentState = ctx.timerController.getState()
  if (!currentState || !currentState.isRunning) {
    return {
      success: false,
      message: 'No timer is running to pause.',
    }
  }

  if (currentState.isPaused) {
    return {
      success: true,
      message: 'Timer is already paused.',
    }
  }

  ctx.timerController.pause()

  const remainingMinutes = Math.ceil(currentState.remainingSeconds / 60)
  return {
    success: true,
    data: { remainingMinutes },
    message: `Paused timer with ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} remaining.`,
  }
}

/**
 * Resume a paused timer
 */
export function resumeTimer(ctx: FunctionContext): FunctionResult {
  if (!ctx.timerController) {
    return {
      success: false,
      message: 'Timer is not available right now.',
    }
  }

  const currentState = ctx.timerController.getState()
  if (!currentState) {
    return {
      success: false,
      message: 'No timer to resume. Start a new timer first.',
    }
  }

  if (!currentState.isPaused) {
    return {
      success: false,
      message: 'Timer is not paused.',
    }
  }

  ctx.timerController.resume()

  const remainingMinutes = Math.ceil(currentState.remainingSeconds / 60)
  return {
    success: true,
    data: { remainingMinutes },
    message: `Resumed timer with ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} remaining.`,
  }
}

/**
 * Stop the focus timer
 */
export function stopTimer(ctx: FunctionContext): FunctionResult {
  if (!ctx.timerController) {
    return {
      success: false,
      message: 'Timer is not available right now.',
    }
  }

  const currentState = ctx.timerController.getState()
  if (!currentState) {
    return {
      success: true,
      message: 'No timer is running.',
    }
  }

  ctx.timerController.stop()

  return {
    success: true,
    message: 'Timer stopped.',
  }
}

/**
 * Get the current timer status
 */
export function getTimerStatus(ctx: FunctionContext): FunctionResult {
  if (!ctx.timerController) {
    return {
      success: false,
      message: 'Timer is not available right now.',
    }
  }

  const currentState = ctx.timerController.getState()
  if (!currentState) {
    return {
      success: true,
      data: { status: 'idle' },
      message: 'No timer is running.',
    }
  }

  const remainingMinutes = Math.ceil(currentState.remainingSeconds / 60)
  const remainingSeconds = currentState.remainingSeconds % 60

  if (currentState.isPaused) {
    return {
      success: true,
      data: { status: 'paused', remainingSeconds: currentState.remainingSeconds },
      message: `Timer is paused with ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} and ${remainingSeconds} seconds remaining.`,
    }
  }

  return {
    success: true,
    data: { status: 'running', remainingSeconds: currentState.remainingSeconds },
    message: `Timer is running with ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} and ${remainingSeconds} seconds remaining.`,
  }
}


/**
 * List all active tasks
 */
export function listTasks(ctx: FunctionContext): FunctionResult {
  const activeTasks = ctx.tasks.filter((t) => !t.completed)

  if (activeTasks.length === 0) {
    return {
      success: true,
      data: { tasks: [] },
      message: "You don't have any active tasks. Would you like to create one?",
    }
  }

  const taskSummaries = activeTasks.map((t) => {
    const completedCount = t.subTasks.filter((st) => st.completed).length
    const totalCount = t.subTasks.length
    return `${t.emoji} ${t.name} (${completedCount}/${totalCount} done)`
  })

  return {
    success: true,
    data: { tasks: activeTasks },
    message: `You have ${activeTasks.length} active task${activeTasks.length !== 1 ? 's' : ''}: ${taskSummaries.join('; ')}`,
  }
}

/**
 * Get details for a specific task
 */
export function getTaskDetails(
  ctx: FunctionContext,
  taskName: string
): FunctionResult {
  const matches = findTaskByName(ctx.tasks, taskName)

  if (matches.length === 0) {
    return {
      success: false,
      message: `I couldn't find a task called "${taskName}". Can you be more specific?`,
    }
  }

  if (matches.length > 1) {
    const names = matches.map((t) => t.name).join(', ')
    return {
      success: false,
      message: `I found multiple tasks matching "${taskName}": ${names}. Which one did you mean?`,
    }
  }

  const task = matches[0]
  const completedCount = task.subTasks.filter((st) => st.completed).length
  const totalCount = task.subTasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const subtaskList = task.subTasks
    .map((st) => `${st.completed ? '✓' : '○'} ${st.name}`)
    .join('; ')

  return {
    success: true,
    data: task,
    message: `${task.emoji} ${task.name}: ${progress}% complete (${completedCount}/${totalCount}). Subtasks: ${subtaskList}`,
  }
}

/**
 * Get the next subtask to work on
 * Logic: 
 * 1. If timer is active with a task, suggest next incomplete subtask from that task
 * 2. Otherwise, find the task with the most progress (highest % complete) that isn't done
 * 3. Return the first incomplete subtask (by sort_order) from that task
 */
export function getNextSubtask(ctx: FunctionContext): FunctionResult {
  // Check if there's an active timer with a task
  const timerState = ctx.timerController?.getState()
  if (timerState?.activeTaskId) {
    const activeTask = ctx.tasks.find((t) => t.id === timerState.activeTaskId)
    if (activeTask) {
      const nextSubtask = activeTask.subTasks
        .filter((st) => !st.completed)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]

      if (nextSubtask) {
        return {
          success: true,
          data: { task: activeTask, subtask: nextSubtask },
          message: `You're working on "${activeTask.name}". Next up: ${nextSubtask.name}`,
        }
      }
    }
  }

  // Find task with highest progress that isn't complete
  const activeTasks = ctx.tasks.filter((t) => !t.completed && t.subTasks.length > 0)

  if (activeTasks.length === 0) {
    return {
      success: true,
      data: null,
      message: "You don't have any active tasks with subtasks. Would you like to create one?",
    }
  }

  // Calculate progress for each task and sort by highest progress
  const tasksWithProgress = activeTasks.map((t) => {
    const completedCount = t.subTasks.filter((st) => st.completed).length
    const progress = t.subTasks.length > 0 ? completedCount / t.subTasks.length : 0
    return { task: t, progress }
  })

  // Sort by progress descending (highest first), but exclude 100% complete
  tasksWithProgress.sort((a, b) => b.progress - a.progress)

  // Find first task that has incomplete subtasks
  for (const { task } of tasksWithProgress) {
    const nextSubtask = task.subTasks
      .filter((st) => !st.completed)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]

    if (nextSubtask) {
      return {
        success: true,
        data: { task, subtask: nextSubtask },
        message: `Next up: "${nextSubtask.name}" from "${task.name}"`,
      }
    }
  }

  return {
    success: true,
    data: null,
    message: 'All your subtasks are complete! Great job!',
  }
}


/**
 * Execute a function call from the assistant
 */
export async function executeFunctionCall(
  call: FunctionCall,
  ctx: FunctionContext
): Promise<FunctionResult> {
  const args = call.arguments

  switch (call.name) {
    case 'createTask':
      return createTask(
        ctx,
        args.description as string,
        args.confirmed as boolean
      )

    case 'completeTask':
      return completeTask(ctx, args.taskName as string)

    case 'completeSubtask':
      return completeSubtask(ctx, args.subtaskName as string)

    case 'renameTask':
      return renameTask(
        ctx,
        args.oldName as string,
        args.newName as string
      )

    case 'renameSubtask':
      return renameSubtask(
        ctx,
        args.oldName as string,
        args.newName as string
      )

    case 'addSubtask':
      return addSubtask(
        ctx,
        args.taskName as string,
        args.subtaskDescription as string
      )

    case 'removeSubtask':
      return removeSubtask(ctx, args.subtaskName as string)

    case 'deleteTask':
      return deleteTask(
        ctx,
        args.taskName as string,
        args.confirmed as boolean
      )

    case 'clearCompletedTasks':
      return clearCompletedTasks(ctx, args.confirmed as boolean)

    case 'setReminder':
      return setReminder(
        ctx,
        args.taskName as string,
        args.time as string
      )

    case 'removeReminder':
      return removeReminder(ctx, args.taskName as string)

    case 'setRecurrence':
      return setRecurrence(
        ctx,
        args.taskName as string,
        args.frequency as string
      )

    case 'startTimer':
      return startTimer(
        ctx,
        args.duration as number | undefined,
        args.taskName as string | undefined
      )

    case 'pauseTimer':
      return pauseTimer(ctx)

    case 'resumeTimer':
      return resumeTimer(ctx)

    case 'stopTimer':
      return stopTimer(ctx)

    case 'getTimerStatus':
      return getTimerStatus(ctx)

    case 'listTasks':
      return listTasks(ctx)

    case 'getTaskDetails':
      return getTaskDetails(ctx, args.taskName as string)

    case 'getNextSubtask':
      return getNextSubtask(ctx)

    default:
      return {
        success: false,
        message: `Unknown function: ${call.name}`,
      }
  }
}
