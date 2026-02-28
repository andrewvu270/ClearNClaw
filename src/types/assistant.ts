import type { BigTask } from './index'

/**
 * Chat message in the assistant conversation
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  functionCalls?: FunctionCallResult[]
}

/**
 * Result of a function call execution
 */
export interface FunctionCallResult {
  name: string
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Timer state for assistant context
 */
export interface TimerState {
  isRunning: boolean
  isPaused: boolean
  remainingSeconds: number
  totalSeconds: number
  activeTaskId: string | null
}

/**
 * Context provided to the assistant for processing commands
 */
export interface AssistantContext {
  userId: string
  tasks: BigTask[] // Limited to 20 most recent active tasks
  timerState: TimerState | null
  lastReferencedTaskId: string | null // For pronoun resolution
  lastReferencedSubtaskId: string | null // For pronoun resolution
  conversationHistory: ChatMessage[] // Last N messages for context
}

/**
 * Function call request from the LLM
 */
export interface FunctionCall {
  name: AssistantFunction
  arguments: Record<string, unknown>
}

/**
 * Result of executing a function call
 */
export interface FunctionResult {
  success: boolean
  data?: unknown
  error?: string
  message: string // Human-readable result for assistant to speak
}

/**
 * All available assistant functions
 */
export type AssistantFunction =
  | 'createTask'
  | 'completeTask'
  | 'completeSubtask'
  | 'renameTask'
  | 'renameSubtask'
  | 'addSubtask'
  | 'removeSubtask'
  | 'deleteTask'
  | 'clearCompletedTasks'
  | 'setReminder'
  | 'removeReminder'
  | 'setRecurrence'
  | 'startTimer'
  | 'pauseTimer'
  | 'resumeTimer'
  | 'stopTimer'
  | 'getTimerStatus'
  | 'listTasks'
  | 'getTaskDetails'
  | 'getNextSubtask'


/**
 * Function parameter definitions for validation
 */
export interface FunctionParameterSchema {
  name: AssistantFunction
  requiredParams: string[]
  optionalParams?: string[]
}

/**
 * Schema definitions for all assistant functions
 */
export const FUNCTION_SCHEMAS: FunctionParameterSchema[] = [
  { name: 'createTask', requiredParams: ['description', 'confirmed'] },
  { name: 'completeTask', requiredParams: ['taskName'] },
  { name: 'completeSubtask', requiredParams: ['subtaskName'] },
  { name: 'renameTask', requiredParams: ['oldName', 'newName'] },
  { name: 'renameSubtask', requiredParams: ['oldName', 'newName'] },
  { name: 'addSubtask', requiredParams: ['taskName', 'subtaskDescription'] },
  { name: 'removeSubtask', requiredParams: ['subtaskName'] },
  { name: 'deleteTask', requiredParams: ['taskName', 'confirmed'] },
  { name: 'clearCompletedTasks', requiredParams: ['confirmed'] },
  { name: 'setReminder', requiredParams: ['taskName', 'time'] },
  { name: 'removeReminder', requiredParams: ['taskName'] },
  { name: 'setRecurrence', requiredParams: ['taskName', 'frequency'] },
  { name: 'startTimer', requiredParams: [], optionalParams: ['duration', 'taskName'] },
  { name: 'pauseTimer', requiredParams: [] },
  { name: 'resumeTimer', requiredParams: [] },
  { name: 'stopTimer', requiredParams: [] },
  { name: 'getTimerStatus', requiredParams: [] },
  { name: 'listTasks', requiredParams: [] },
  { name: 'getTaskDetails', requiredParams: ['taskName'] },
  { name: 'getNextSubtask', requiredParams: [] },
]

/**
 * Validates that a function call includes all required parameters
 */
export function validateFunctionCall(call: FunctionCall): { valid: boolean; missingParams: string[] } {
  const schema = FUNCTION_SCHEMAS.find((s) => s.name === call.name)
  if (!schema) {
    return { valid: false, missingParams: ['unknown function'] }
  }

  const missingParams = schema.requiredParams.filter(
    (param) => !(param in call.arguments) || call.arguments[param] === undefined
  )

  return {
    valid: missingParams.length === 0,
    missingParams,
  }
}

/**
 * Voice call state
 */
export type VoiceState = 'idle' | 'connecting' | 'active' | 'error'

/**
 * Stored chat session for localStorage persistence
 */
export interface StoredChatSession {
  userId: string
  messages: ChatMessage[] // Limited to last 50 messages
  lastReferencedTaskId: string | null
  lastReferencedSubtaskId: string | null
  lastUpdated: string // ISO date string
}

/**
 * Conversation state for tracking context
 */
export interface ConversationState {
  lastReferencedTaskId: string | null
  lastReferencedSubtaskId: string | null
}
