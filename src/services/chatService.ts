import { supabase } from '../lib/supabase'
import type { AssistantContext, ChatMessage, FunctionCall, FunctionResult } from '../types/assistant'
import { ASSISTANT_SYSTEM_PROMPT, ASSISTANT_FUNCTION_DEFINITIONS } from './assistantPrompt'
import { executeFunctionCall, type FunctionContext, type TimerController } from './assistantFunctions'
import { updateContextAfterOperation } from './assistantContext'

/**
 * LLM context window limit for messages (to manage token costs)
 */
const LLM_CONTEXT_MESSAGE_LIMIT = 10

/**
 * Groq API response types
 */
interface GroqMessage {
  role: 'assistant'
  content: string | null
  tool_calls?: GroqToolCall[]
}

interface GroqToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface GroqResponse {
  choices: {
    message: GroqMessage
    finish_reason: string
  }[]
}

/**
 * Pending action state for confirmation flows
 */
export interface PendingAction {
  type: 'createTask' | 'deleteTask' | 'clearCompletedTasks'
  params: Record<string, unknown>
  timestamp: number
}

/**
 * Chat service state
 */
export interface ChatServiceState {
  pendingAction: PendingAction | null
}

/**
 * Creates initial chat service state
 */
export function createChatServiceState(): ChatServiceState {
  return {
    pendingAction: null,
  }
}

/**
 * Builds the message array for the LLM, including system prompt and conversation history
 */
function buildLLMMessages(
  context: AssistantContext,
  userMessage: string
): { role: string; content: string }[] {
  // Build task context summary for the system prompt
  const taskSummary = context.tasks.length > 0
    ? `\n\nCurrent tasks (${context.tasks.length}):\n${context.tasks.map(t => {
        const done = t.subTasks.filter(st => st.completed).length
        const total = t.subTasks.length
        return `- ${t.emoji} ${t.name} (${done}/${total} subtasks done)`
      }).join('\n')}`
    : '\n\nNo active tasks.'

  const timerInfo = context.timerState
    ? `\n\nTimer: ${context.timerState.isRunning ? 'Running' : context.timerState.isPaused ? 'Paused' : 'Idle'}, ${Math.ceil(context.timerState.remainingSeconds / 60)} min remaining`
    : ''

  const systemPrompt = ASSISTANT_SYSTEM_PROMPT + taskSummary + timerInfo

  // Get recent conversation history (limited to manage tokens)
  const recentHistory = context.conversationHistory.slice(-LLM_CONTEXT_MESSAGE_LIMIT)

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ]

  return messages
}

/**
 * Parses function calls from Groq response
 */
function parseFunctionCalls(message: GroqMessage): FunctionCall[] {
  if (!message.tool_calls || message.tool_calls.length === 0) {
    return []
  }

  return message.tool_calls.map(toolCall => {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch {
      console.error('Failed to parse function arguments:', toolCall.function.arguments)
    }

    return {
      name: toolCall.function.name as FunctionCall['name'],
      arguments: args,
    }
  })
}

/**
 * Checks if a user message is a confirmation response
 */
export function isConfirmationResponse(message: string): boolean {
  const confirmPatterns = [
    /^yes$/i,
    /^yeah$/i,
    /^yep$/i,
    /^sure$/i,
    /^ok$/i,
    /^okay$/i,
    /^do it$/i,
    /^go ahead$/i,
    /^confirm$/i,
    /^confirmed$/i,
    /^please$/i,
    /^yes,?\s*please$/i,
    /^that'?s? right$/i,
    /^correct$/i,
  ]
  return confirmPatterns.some(pattern => pattern.test(message.trim()))
}

/**
 * Checks if a user message is a denial/cancellation response
 */
export function isDenialResponse(message: string): boolean {
  const denyPatterns = [
    /^no$/i,
    /^nope$/i,
    /^nah$/i,
    /^cancel$/i,
    /^never\s*mind$/i,
    /^forget\s*it$/i,
    /^don'?t$/i,
    /^stop$/i,
  ]
  return denyPatterns.some(pattern => pattern.test(message.trim()))
}

/**
 * Checks if a function call requires confirmation
 */
function requiresConfirmation(call: FunctionCall): boolean {
  const confirmationFunctions = ['createTask', 'deleteTask', 'clearCompletedTasks']
  return confirmationFunctions.includes(call.name)
}

/**
 * Checks if a function call has confirmation set to true
 */
function hasConfirmation(call: FunctionCall): boolean {
  return call.arguments.confirmed === true
}

/**
 * Result of sending a message
 */
export interface SendMessageResult {
  response: string
  functionResults: FunctionResult[]
  updatedContext: AssistantContext
  updatedState: ChatServiceState
}

/**
 * Sends a message to the assistant and processes the response.
 * Handles function calling, confirmation flows, and context updates.
 */
export async function sendMessage(
  message: string,
  context: AssistantContext,
  state: ChatServiceState,
  timerController?: TimerController
): Promise<SendMessageResult> {
  const functionResults: FunctionResult[] = []
  let updatedContext = context
  let updatedState = { ...state }

  // Check if this is a response to a pending action
  if (state.pendingAction) {
    if (isConfirmationResponse(message)) {
      // Execute the pending action with confirmed=true
      const confirmedCall: FunctionCall = {
        name: state.pendingAction.type,
        arguments: { ...state.pendingAction.params, confirmed: true },
      }

      const functionContext: FunctionContext = {
        userId: context.userId,
        tasks: context.tasks,
        timerController,
      }

      const result = await executeFunctionCall(confirmedCall, functionContext)
      functionResults.push(result)

      // Update context after operation
      if (result.success && result.data) {
        const taskId = extractTaskId(result.data)
        updatedContext = await updateContextAfterOperation(context, taskId)
      }

      // Clear pending action
      updatedState.pendingAction = null

      return {
        response: result.message,
        functionResults,
        updatedContext,
        updatedState,
      }
    } else if (isDenialResponse(message)) {
      // Cancel the pending action
      updatedState.pendingAction = null
      return {
        response: "No problem, I've cancelled that.",
        functionResults,
        updatedContext,
        updatedState,
      }
    }
    // If neither confirm nor deny, clear pending and process as new message
    updatedState.pendingAction = null
  }

  // Build messages for LLM
  const messages = buildLLMMessages(context, message)

  // Call Groq via the ai-proxy edge function
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: {
      action: 'chat',
      messages,
      functions: ASSISTANT_FUNCTION_DEFINITIONS,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to get assistant response')
  }

  const groqResponse = data as GroqResponse
  const assistantMessage = groqResponse.choices?.[0]?.message

  if (!assistantMessage) {
    throw new Error('No response from assistant')
  }

  // Parse any function calls
  const functionCalls = parseFunctionCalls(assistantMessage)

  // Process function calls
  for (const call of functionCalls) {
    // Check if this requires confirmation but doesn't have it
    if (requiresConfirmation(call) && !hasConfirmation(call)) {
      // Store as pending action and return the confirmation request
      updatedState.pendingAction = {
        type: call.name as PendingAction['type'],
        params: { ...call.arguments },
        timestamp: Date.now(),
      }

      // The LLM should have generated a confirmation message
      const responseText = assistantMessage.content || getDefaultConfirmationMessage(call)
      
      return {
        response: responseText,
        functionResults,
        updatedContext,
        updatedState,
      }
    }

    // Execute the function call
    const functionContext: FunctionContext = {
      userId: context.userId,
      tasks: updatedContext.tasks,
      timerController,
    }

    const result = await executeFunctionCall(call, functionContext)
    functionResults.push(result)

    // Update context after operation if successful
    if (result.success && result.data) {
      const taskId = extractTaskId(result.data)
      const subtaskId = extractSubtaskId(result.data)
      updatedContext = await updateContextAfterOperation(updatedContext, taskId, subtaskId)
    }
  }

  // Build response text
  let responseText = assistantMessage.content || ''

  // If there were function calls but no text response, use the function result messages
  if (!responseText && functionResults.length > 0) {
    responseText = functionResults.map(r => r.message).join(' ')
  }

  return {
    response: responseText,
    functionResults,
    updatedContext,
    updatedState,
  }
}

/**
 * Extracts task ID from function result data
 */
function extractTaskId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  // Direct task object
  if ('id' in obj && typeof obj.id === 'string') {
    return obj.id
  }
  
  // Nested task object
  if ('task' in obj && typeof obj.task === 'object' && obj.task !== null) {
    const task = obj.task as Record<string, unknown>
    if ('id' in task && typeof task.id === 'string') {
      return task.id
    }
  }
  
  return null
}

/**
 * Extracts subtask ID from function result data
 */
function extractSubtaskId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  // Direct subtask object with bigTaskId (indicates it's a subtask)
  if ('bigTaskId' in obj && 'id' in obj && typeof obj.id === 'string') {
    return obj.id
  }
  
  // Nested subtask object
  if ('subtask' in obj && typeof obj.subtask === 'object' && obj.subtask !== null) {
    const subtask = obj.subtask as Record<string, unknown>
    if ('id' in subtask && typeof subtask.id === 'string') {
      return subtask.id
    }
  }
  
  return null
}

/**
 * Gets a default confirmation message for a function call
 */
function getDefaultConfirmationMessage(call: FunctionCall): string {
  switch (call.name) {
    case 'createTask':
      return `Should I create a task called "${call.arguments.description}"?`
    case 'deleteTask':
      return `Are you sure you want to delete "${call.arguments.taskName}"? This cannot be undone.`
    case 'clearCompletedTasks':
      return 'Are you sure you want to clear all completed tasks? This cannot be undone.'
    default:
      return 'Please confirm this action.'
  }
}
