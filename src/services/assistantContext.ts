import { supabase } from '../lib/supabase'
import type { BigTask, SubTask } from '../types'
import type { AssistantContext, ConversationState, ChatMessage, TimerState } from '../types/assistant'
import { parseEnergyTag } from '../utils/energyTag'

/**
 * Maximum number of active tasks to load into assistant context
 */
export const MAX_CONTEXT_TASKS = 20

/**
 * Pronoun patterns that reference the last mentioned task
 */
const TASK_PRONOUN_PATTERNS = [
  /\bit\b/i,
  /\bthat task\b/i,
  /\bthe last one\b/i,
  /\bthis task\b/i,
  /\bthe task\b/i,
]

/**
 * Subtask pronoun patterns
 */
const SUBTASK_PRONOUN_PATTERNS = [
  /\bthat subtask\b/i,
  /\bthe subtask\b/i,
  /\bthis subtask\b/i,
]

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
    recurrence: null, // Not needed for assistant context
  }
}

/**
 * Loads the 20 most recently updated active (non-completed) tasks for assistant context.
 * Tasks are ordered by updated_at descending to prioritize actively worked-on tasks.
 * 
 * @param userId - The user's ID
 * @returns Array of BigTask objects limited to MAX_CONTEXT_TASKS
 */
export async function loadTaskContext(userId: string): Promise<BigTask[]> {
  const { data: tasks, error } = await supabase
    .from('big_tasks')
    .select('*, sub_tasks(*)')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(MAX_CONTEXT_TASKS)

  if (error) throw error

  return (tasks ?? []).map(row => {
    const subTasks = ((row.sub_tasks as Record<string, unknown>[]) ?? [])
      .map(mapSubTask)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return mapBigTask(row, subTasks)
  })
}


/**
 * Result of pronoun resolution
 */
export interface ResolvedReference {
  taskId: string | null
  subtaskId: string | null
  needsClarification: boolean
  clarificationMessage?: string
}

/**
 * Checks if a text contains pronoun references to tasks
 */
export function containsTaskPronoun(text: string): boolean {
  return TASK_PRONOUN_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * Checks if a text contains pronoun references to subtasks
 */
export function containsSubtaskPronoun(text: string): boolean {
  return SUBTASK_PRONOUN_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * Resolves pronoun references ("it", "that task", "the last one") to actual task/subtask IDs.
 * Uses the conversation state to track the last referenced items.
 * 
 * @param text - The user's input text
 * @param conversationState - Current conversation state with last referenced IDs
 * @param tasks - Available tasks in context for validation
 * @returns Resolved reference with task/subtask IDs or clarification request
 */
export function resolveTaskReference(
  text: string,
  conversationState: ConversationState,
  tasks: BigTask[]
): ResolvedReference {
  const hasTaskPronoun = containsTaskPronoun(text)
  const hasSubtaskPronoun = containsSubtaskPronoun(text)

  // If no pronouns detected, no resolution needed
  if (!hasTaskPronoun && !hasSubtaskPronoun) {
    return {
      taskId: null,
      subtaskId: null,
      needsClarification: false,
    }
  }

  // Handle subtask pronoun resolution
  if (hasSubtaskPronoun) {
    if (conversationState.lastReferencedSubtaskId) {
      // Validate the subtask still exists in context
      const subtaskExists = tasks.some(task =>
        task.subTasks.some(st => st.id === conversationState.lastReferencedSubtaskId)
      )
      if (subtaskExists) {
        return {
          taskId: conversationState.lastReferencedTaskId,
          subtaskId: conversationState.lastReferencedSubtaskId,
          needsClarification: false,
        }
      }
    }
    return {
      taskId: null,
      subtaskId: null,
      needsClarification: true,
      clarificationMessage: "I'm not sure which subtask you're referring to. Could you specify the subtask name?",
    }
  }

  // Handle task pronoun resolution
  if (hasTaskPronoun) {
    if (conversationState.lastReferencedTaskId) {
      // Validate the task still exists in context
      const taskExists = tasks.some(task => task.id === conversationState.lastReferencedTaskId)
      if (taskExists) {
        return {
          taskId: conversationState.lastReferencedTaskId,
          subtaskId: null,
          needsClarification: false,
        }
      }
    }
    return {
      taskId: null,
      subtaskId: null,
      needsClarification: true,
      clarificationMessage: "I'm not sure which task you're referring to. Could you specify the task name?",
    }
  }

  return {
    taskId: null,
    subtaskId: null,
    needsClarification: false,
  }
}

/**
 * Updates the conversation state after a task operation.
 * Should be called after any operation that references a specific task or subtask.
 * 
 * @param currentState - Current conversation state
 * @param taskId - The task ID that was just referenced/operated on
 * @param subtaskId - Optional subtask ID that was just referenced/operated on
 * @returns Updated conversation state
 */
export function updateConversationState(
  currentState: ConversationState,
  taskId: string | null,
  subtaskId: string | null = null
): ConversationState {
  return {
    lastReferencedTaskId: taskId ?? currentState.lastReferencedTaskId,
    lastReferencedSubtaskId: subtaskId ?? (taskId ? null : currentState.lastReferencedSubtaskId),
  }
}

/**
 * Creates an initial conversation state
 */
export function createInitialConversationState(): ConversationState {
  return {
    lastReferencedTaskId: null,
    lastReferencedSubtaskId: null,
  }
}

/**
 * Creates an initial assistant context for a user session.
 * 
 * @param userId - The user's ID
 * @param timerState - Current timer state (if any)
 * @param conversationHistory - Previous messages in the conversation
 * @returns Complete AssistantContext
 */
export async function createAssistantContext(
  userId: string,
  timerState: TimerState | null = null,
  conversationHistory: ChatMessage[] = []
): Promise<AssistantContext> {
  const tasks = await loadTaskContext(userId)
  
  return {
    userId,
    tasks,
    timerState,
    lastReferencedTaskId: null,
    lastReferencedSubtaskId: null,
    conversationHistory,
  }
}

/**
 * Refreshes the task list in an existing assistant context.
 * Called after task operations to ensure context reflects current state.
 * 
 * @param context - Current assistant context
 * @returns Updated assistant context with fresh task data
 */
export async function refreshTaskContext(context: AssistantContext): Promise<AssistantContext> {
  const tasks = await loadTaskContext(context.userId)
  
  return {
    ...context,
    tasks,
  }
}

/**
 * Updates the assistant context after a task operation.
 * Refreshes task data and updates the last referenced task/subtask.
 * 
 * @param context - Current assistant context
 * @param taskId - The task ID that was operated on
 * @param subtaskId - Optional subtask ID that was operated on
 * @returns Updated assistant context
 */
export async function updateContextAfterOperation(
  context: AssistantContext,
  taskId: string | null,
  subtaskId: string | null = null
): Promise<AssistantContext> {
  const tasks = await loadTaskContext(context.userId)
  
  return {
    ...context,
    tasks,
    lastReferencedTaskId: taskId ?? context.lastReferencedTaskId,
    lastReferencedSubtaskId: subtaskId ?? (taskId ? null : context.lastReferencedSubtaskId),
  }
}
