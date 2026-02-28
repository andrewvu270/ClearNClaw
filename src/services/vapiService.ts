import Vapi from '@vapi-ai/web'
import type {
  AssistantContext,
  FunctionCall,
  FunctionResult,
  VoiceState,
} from '../types/assistant'
import { KLAW_VOICE_PROMPT } from './assistantPrompt'
import {
  executeFunctionCall,
  type FunctionContext,
  type TimerController,
} from './assistantFunctions'
import { updateContextAfterOperation } from './assistantContext'

/**
 * Vapi tool definition format
 */
interface VapiTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}

/**
 * Tool definitions for Vapi server-side function calling
 * These are sent to Vapi so the LLM knows what functions are available
 */
export const VAPI_TOOL_DEFINITIONS: VapiTool[] = [
  {
    type: 'function',
    function: {
      name: 'createTask',
      description:
        'Create a NEW task. ONLY use for genuinely new tasks. Do NOT use to modify existing tasks/subtasks - use renameSubtask or addSubtask instead. Check if similar task exists first to avoid duplicates.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'The task description/name' },
          confirmed: {
            type: 'boolean',
            description: 'Set to true only after user explicitly confirms. Set to false to ask for confirmation.',
          },
        },
        required: ['description', 'confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeTask',
      description: 'Mark a task as completed. Use when user says done, finished, complete, check off, etc.',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name or partial name of the task' },
        },
        required: ['taskName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeSubtask',
      description: 'Mark a subtask as completed. Use when user says done, finished, complete, check off, etc.',
      parameters: {
        type: 'object',
        properties: {
          subtaskName: { type: 'string', description: 'Name or partial name of the subtask' },
        },
        required: ['subtaskName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteTask',
      description: 'Delete a task. First ask user to confirm, then call with confirmed=true.',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name of the task to delete' },
          confirmed: { type: 'boolean', description: 'Set to true only after user explicitly confirms.' },
        },
        required: ['taskName', 'confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'renameTask',
      description: 'Rename/change a task name. Use when user wants to edit task title.',
      parameters: {
        type: 'object',
        properties: {
          oldName: { type: 'string', description: 'Current name or partial match' },
          newName: { type: 'string', description: 'New name for the task' },
        },
        required: ['oldName', 'newName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearCompletedTasks',
      description: 'Delete all completed tasks. ALWAYS ask for confirmation first.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', description: 'Set to true only after user explicitly confirms.' },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setReminder',
      description: 'Set a ONE-TIME reminder for a task at a specific time. Use for "remind me at 3pm", "remind me tomorrow". Do NOT use for repeating schedules - use setRecurrence instead.',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name of the task' },
          time: { type: 'string', description: 'Specific time: "3pm", "tomorrow 9am", "in 2 hours", "Monday 3pm". NOT for frequencies like daily/weekly/monthly.' },
        },
        required: ['taskName', 'time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeReminder',
      description: 'Remove/cancel a reminder from a task.',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name of the task' },
        },
        required: ['taskName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setRecurrence',
      description: 'Set a task to REPEAT on a schedule. Use for "repeat daily", "make it weekly", "monthly", "every week", "every day". Do NOT use setReminder for repeating schedules.',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name of the task' },
          frequency: { type: 'string', description: 'How often to repeat: daily, weekdays, weekly, monthly, yearly' },
        },
        required: ['taskName', 'frequency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'startTimer',
      description: 'Start a focus timer. Call this when user says "start timer", "timer", "focus", "pomodoro", etc. Default 25 minutes.',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: 'Duration in minutes. Default 25.' },
          taskName: { type: 'string', description: 'Optional: task to link timer to' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pauseTimer',
      description: 'Pause the running focus timer.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumeTimer',
      description: 'Resume a paused focus timer.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stopTimer',
      description: 'Stop and reset the focus timer.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTimerStatus',
      description: 'Get current timer status. Use when user asks "how much time left", "timer status", etc.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listTasks',
      description: 'List all active tasks with their progress. Use when user asks "what are my tasks", "show tasks", etc.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTaskDetails',
      description: 'Get detailed info about a specific task including all subtasks.',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name or partial name of the task' },
        },
        required: ['taskName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getNextSubtask',
      description: 'Get the next subtask to work on. Use when user asks "what should I do", "what\'s next", "help me focus".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'renameSubtask',
      description:
        'Rename/change/edit a subtask. USE THIS when user says "change subtask", "edit subtask", "rename subtask", or "change X to Y" where X is a subtask. Do NOT use createTask for this!',
      parameters: {
        type: 'object',
        properties: {
          oldName: { type: 'string', description: 'Current subtask name or partial match' },
          newName: { type: 'string', description: 'New name for the subtask' },
        },
        required: ['oldName', 'newName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addSubtask',
      description:
        'Add a new subtask to an EXISTING task. Use when user says "add subtask", "add step", "add to task". Do NOT use createTask for this!',
      parameters: {
        type: 'object',
        properties: {
          taskName: { type: 'string', description: 'Name of the parent task to add subtask to' },
          subtaskDescription: { type: 'string', description: 'The subtask text/description' },
        },
        required: ['taskName', 'subtaskDescription'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeSubtask',
      description: 'Remove/delete a subtask from a task.',
      parameters: {
        type: 'object',
        properties: {
          subtaskName: { type: 'string', description: 'Name or partial name of subtask to remove' },
        },
        required: ['subtaskName'],
      },
    },
  },
]

/**
 * VapiService - Manages voice session lifecycle with Vapi for Klaw (voice assistant)
 *
 * This service handles:
 * - Initializing and managing Vapi client
 * - Starting and ending voice sessions
 * - Processing function calls from Vapi
 * - Emitting events for transcript, response, function calls, and errors
 */

/**
 * Regex to match ACTION tags in model output
 * Format: [ACTION:functionName:{"param":"value"}]
 */
const ACTION_TAG_REGEX = /\[ACTION:(\w+):(\{[^}]*\})\]/g

/**
 * Event callbacks for VapiService
 */
export interface VapiServiceCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void
  onResponse?: (text: string) => void
  onFunctionCall?: (call: FunctionCall, result: FunctionResult) => void
  onStateChange?: (state: VoiceState) => void
  onError?: (error: Error) => void
}

/**
 * VapiService class for managing voice sessions
 */
export class VapiService {
  private vapi: Vapi | null = null
  private callbacks: VapiServiceCallbacks = {}
  private context: AssistantContext | null = null
  private timerController: TimerController | null = null
  private currentState: VoiceState = 'idle'
  private modelOutputBuffer: string = ''
  private processedActions: Set<string> = new Set()

  /**
   * Initialize the Vapi client with API key
   */
  constructor() {
    const apiKey = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined
    if (!apiKey) {
      console.warn('VITE_VAPI_PUBLIC_KEY not configured - voice features will be unavailable')
      return
    }

    this.vapi = new Vapi(apiKey)
    this.setupEventHandlers()
  }

  /**
   * Set up event handlers for Vapi events
   */
  private setupEventHandlers(): void {
    if (!this.vapi) return

    // Handle call start
    this.vapi.on('call-start', () => {
      this.setState('active')
    })

    // Handle call end
    this.vapi.on('call-end', () => {
      this.setState('idle')
    })

    // Handle speech start (user started speaking)
    this.vapi.on('speech-start', () => {
      // Could be used for visual feedback
    })

    // Handle speech end (user stopped speaking)
    this.vapi.on('speech-end', () => {
      // Could be used for visual feedback
    })

    // Handle transcript updates
    this.vapi.on('message', (message) => {
      this.handleMessage(message)
    })

    // Handle errors
    this.vapi.on('error', (error) => {
      console.error('Vapi error:', error)
      this.setState('error')
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
    })
  }

  /**
   * Handle incoming messages from Vapi
   */
  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as Record<string, unknown>
    
    // Debug log to see message structure
    console.log('Vapi message:', msg.type, JSON.stringify(msg, null, 2))
    
    switch (msg.type) {
      case 'transcript': {
        // User or assistant speech transcript
        const role = msg.role as string
        const transcript = msg.transcript as string
        const isFinal = msg.transcriptType === 'final'
        
        if (role === 'assistant') {
          // Only show final assistant transcripts to avoid repetition
          if (isFinal) {
            this.callbacks.onResponse?.(transcript)
          }
        } else {
          // User speaking - show partials for feedback, but mark if final
          this.callbacks.onTranscript?.(transcript, isFinal)
        }
        break
      }

      case 'function-call': {
        // Function call from the assistant
        console.log('Function call received:', msg)
        await this.handleFunctionCall(msg)
        break
      }

      case 'tool-calls': {
        // Alternative format for tool/function calls
        // Note: Vapi sends arguments as an object, not a string
        console.log('Tool calls received:', msg)
        const toolCalls = msg.toolCalls as Array<{ function: { name: string; arguments: Record<string, unknown> | string } }> | undefined
        if (toolCalls) {
          for (const toolCall of toolCalls) {
            // Handle both object and string arguments (Vapi sends objects)
            const args = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments || '{}')
              : toolCall.function.arguments || {}
            const funcMsg = {
              functionCall: {
                name: toolCall.function.name,
                parameters: args,
              },
            }
            await this.handleFunctionCall(funcMsg)
          }
        }
        break
      }

      case 'tool-call-result': {
        // Result from server-side function call (webhook response)
        // Check for timer instructions that need client-side execution
        console.log('Tool call result received:', msg)
        const result = msg.result as string | undefined
        if (result) {
          try {
            const parsedResult = JSON.parse(result) as FunctionResult
            this.checkAndExecuteTimerInstructions(parsedResult)
            
            // Notify callback about the function result
            const name = msg.name as string | undefined
            if (name) {
              const call: FunctionCall = {
                name: name as FunctionCall['name'],
                arguments: {},
              }
              this.callbacks.onFunctionCall?.(call, parsedResult)
            }
          } catch (error) {
            console.error('Failed to parse tool call result:', error)
          }
        }
        break
      }

      case 'hang':
        // Call ended
        this.setState('idle')
        break

      case 'conversation-update': {
        // Conversation update - can contain assistant messages
        // Skip this to avoid duplicates since we handle transcript messages
        break
      }

      case 'speech-update': {
        // Assistant speech status update
        const status = msg.status as string
        const role = msg.role as string
        if (status === 'started' && role === 'assistant') {
          // New assistant turn starting - reset buffer
          this.modelOutputBuffer = ''
          this.processedActions.clear()
        }
        break
      }

      case 'model-output': {
        // Raw model output - accumulate and check for ACTION tags
        const output = msg.output as string | undefined
        if (typeof output === 'string') {
          this.modelOutputBuffer += output
          // Check for complete ACTION tags and execute them
          await this.parseAndExecuteActionTags()
        }
        break
      }

      case 'voice-input': {
        // Voice input chunk - reset buffer for new turn
        // This indicates the model is generating a new response
        break
      }
    }
  }

  /**
   * Parse ACTION tags from model output buffer and execute them
   */
  private async parseAndExecuteActionTags(): Promise<void> {
    if (!this.context) return

    // Find all ACTION tags in the buffer
    const matches = [...this.modelOutputBuffer.matchAll(ACTION_TAG_REGEX)]

    for (const match of matches) {
      const fullMatch = match[0]
      const functionName = match[1]
      const argsJson = match[2]

      // Skip if we've already processed this exact action
      const actionKey = `${functionName}:${argsJson}`
      if (this.processedActions.has(actionKey)) {
        continue
      }

      try {
        const args = JSON.parse(argsJson)
        console.log('Executing ACTION tag:', functionName, args)

        // Mark as processed before executing
        this.processedActions.add(actionKey)

        // Create function call
        const call: FunctionCall = {
          name: functionName as FunctionCall['name'],
          arguments: args,
        }

        // Create function context
        const functionContext: FunctionContext = {
          userId: this.context.userId,
          tasks: this.context.tasks,
          timerController: this.timerController || undefined,
        }

        // Execute the function call
        const result = await executeFunctionCall(call, functionContext)

        // Update context after operation if successful
        if (result.success && result.data) {
          const taskId = this.extractTaskId(result.data)
          const subtaskId = this.extractSubtaskId(result.data)
          this.context = await updateContextAfterOperation(
            this.context,
            taskId,
            subtaskId
          )
        }

        // Notify callback
        this.callbacks.onFunctionCall?.(call, result)

        console.log('ACTION result:', result)
      } catch (error) {
        console.error('Failed to parse/execute ACTION tag:', fullMatch, error)
      }
    }
  }

  /**
   * Handle function calls from Vapi
   */
  private async handleFunctionCall(msg: Record<string, unknown>): Promise<void> {
    if (!this.context || !this.vapi) return

    const functionCall = msg.functionCall as { name: string; parameters: Record<string, unknown> } | undefined
    if (!functionCall) return

    const call: FunctionCall = {
      name: functionCall.name as FunctionCall['name'],
      arguments: functionCall.parameters || {},
    }

    // Create function context
    const functionContext: FunctionContext = {
      userId: this.context.userId,
      tasks: this.context.tasks,
      timerController: this.timerController || undefined,
    }

    // Execute the function call
    const result = await executeFunctionCall(call, functionContext)

    // Update context after operation if successful
    if (result.success && result.data) {
      const taskId = this.extractTaskId(result.data)
      const subtaskId = this.extractSubtaskId(result.data)
      this.context = await updateContextAfterOperation(this.context, taskId, subtaskId)
    }

    // Notify callback
    this.callbacks.onFunctionCall?.(call, result)

    // Send result back to Vapi
    this.vapi.send({
      type: 'add-message',
      message: {
        role: 'function',
        name: call.name,
        content: JSON.stringify(result),
      },
    })
  }

  /**
   * Handle timer instructions from webhook responses
   * Timer functions can't run server-side, so the webhook returns instructions
   * that we execute client-side via the timerController
   */
  private handleTimerInstruction(data: Record<string, unknown>): void {
    if (!this.timerController) {
      console.warn('Timer instruction received but no timerController available')
      return
    }

    const action = data.action as string
    console.log('Executing timer instruction:', action, data)

    switch (action) {
      case 'startTimer': {
        const duration = (data.duration as number) ?? 25
        const taskName = data.taskName as string | undefined
        const durationMs = duration * 60 * 1000

        // If task name provided, find and set it as active
        if (taskName && this.context) {
          const lowerName = taskName.toLowerCase()
          const matchingTask = this.context.tasks.find(
            (t) => t.name.toLowerCase().includes(lowerName)
          )
          if (matchingTask) {
            this.timerController.setActiveTask(matchingTask)
          }
        }

        this.timerController.start(durationMs)
        break
      }

      case 'pauseTimer':
        this.timerController.pause()
        break

      case 'resumeTimer':
        this.timerController.resume()
        break

      case 'stopTimer':
        this.timerController.stop()
        break

      default:
        console.warn('Unknown timer action:', action)
    }
  }

  /**
   * Check if a function result contains timer instructions and execute them
   */
  private checkAndExecuteTimerInstructions(result: FunctionResult): void {
    if (!result.success || !result.data) return

    const data = result.data as Record<string, unknown>
    if (data.action && typeof data.action === 'string') {
      const timerActions = ['startTimer', 'pauseTimer', 'resumeTimer', 'stopTimer']
      if (timerActions.includes(data.action)) {
        this.handleTimerInstruction(data)
      }
    }
  }

  /**
   * Extract task ID from function result data
   */
  private extractTaskId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null
    
    const obj = data as Record<string, unknown>
    
    if ('id' in obj && typeof obj.id === 'string') {
      return obj.id
    }
    
    if ('task' in obj && typeof obj.task === 'object' && obj.task !== null) {
      const task = obj.task as Record<string, unknown>
      if ('id' in task && typeof task.id === 'string') {
        return task.id
      }
    }
    
    return null
  }

  /**
   * Extract subtask ID from function result data
   */
  private extractSubtaskId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null
    
    const obj = data as Record<string, unknown>
    
    if ('bigTaskId' in obj && 'id' in obj && typeof obj.id === 'string') {
      return obj.id
    }
    
    if ('subtask' in obj && typeof obj.subtask === 'object' && obj.subtask !== null) {
      const subtask = obj.subtask as Record<string, unknown>
      if ('id' in subtask && typeof subtask.id === 'string') {
        return subtask.id
      }
    }
    
    return null
  }

  /**
   * Set the current state and notify callback
   */
  private setState(state: VoiceState): void {
    this.currentState = state
    this.callbacks.onStateChange?.(state)
  }

  /**
   * Build task context for the system prompt
   */
  private buildTaskContext(): string {
    if (!this.context || this.context.tasks.length === 0) {
      return 'No active tasks.'
    }

    const taskLines = this.context.tasks
      .filter((t) => !t.completed)
      .slice(0, 10) // Limit to 10 tasks for voice
      .map((t) => {
        const done = t.subTasks.filter((st) => st.completed).length
        const total = t.subTasks.length
        return `- ${t.emoji} ${t.name} (${done}/${total} done)`
      })

    if (taskLines.length === 0) {
      return 'No active tasks.'
    }

    return taskLines.join('\n')
  }

  /**
   * Build the assistant configuration for Vapi with server-side function calling
   */
  private buildAssistantConfig(userId: string) {
    // Build task context for the system prompt
    const taskContext = this.buildTaskContext()

    // Add timer info if available
    const timerInfo = this.context?.timerState
      ? `\n\nTimer: ${this.context.timerState.isRunning ? 'Running' : this.context.timerState.isPaused ? 'Paused' : 'Idle'}, ${Math.ceil(this.context.timerState.remainingSeconds / 60)} min remaining`
      : ''

    // Replace {taskContext} placeholder in the prompt
    const systemPrompt = KLAW_VOICE_PROMPT.replace('{taskContext}', taskContext) + timerInfo

    // Get webhook URL from environment
    const webhookUrl = import.meta.env.VITE_VAPI_WEBHOOK_URL as string | undefined

    // Build config with server-side function calling
    const config: Record<string, unknown> = {
      name: 'Klaw',
      firstMessage: "Hey! What's up?",
      model: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
        tools: VAPI_TOOL_DEFINITIONS,
        temperature: 0.7,
        maxTokens: 150,
      },
      voice: {
        provider: 'vapi',
        voiceId: 'Elliot',
      },
      // Transcriber settings
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en',
      },
      // Timing settings
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.3,
      // Prevent interruptions and echo
      backchannelingEnabled: false,
      backgroundDenoisingEnabled: true,
      metadata: {
        userId,
      },
    }

    // Add serverUrl if configured (for server-side function calling)
    if (webhookUrl) {
      config.serverUrl = webhookUrl
    }

    return config
  }

  /**
   * Start a voice session with the given context
   */
  async startSession(
    context: AssistantContext,
    timerController?: TimerController
  ): Promise<void> {
    if (!this.vapi) {
      throw new Error('Vapi client not initialized - check VITE_VAPI_API_KEY')
    }

    this.context = context
    this.timerController = timerController || null
    this.setState('connecting')

    try {
      const config = this.buildAssistantConfig(context.userId)
      await this.vapi.start(config as unknown as Parameters<typeof this.vapi.start>[0])
    } catch (error) {
      this.setState('error')
      throw error
    }
  }

  /**
   * End the current voice session
   */
  endSession(): void {
    if (!this.vapi) return
    
    this.vapi.stop()
    this.setState('idle')
    this.context = null
    this.timerController = null
  }

  /**
   * Register callback for transcript events
   */
  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.callbacks.onTranscript = callback
  }

  /**
   * Register callback for assistant response events
   */
  onResponse(callback: (text: string) => void): void {
    this.callbacks.onResponse = callback
  }

  /**
   * Register callback for function call events
   */
  onFunctionCall(callback: (call: FunctionCall, result: FunctionResult) => void): void {
    this.callbacks.onFunctionCall = callback
  }

  /**
   * Register callback for state change events
   */
  onStateChange(callback: (state: VoiceState) => void): void {
    this.callbacks.onStateChange = callback
  }

  /**
   * Register callback for error events
   */
  onError(callback: (error: Error) => void): void {
    this.callbacks.onError = callback
  }

  /**
   * Get the current voice state
   */
  getState(): VoiceState {
    return this.currentState
  }

  /**
   * Get the current context (for external updates)
   */
  getContext(): AssistantContext | null {
    return this.context
  }

  /**
   * Update the context (e.g., after external task changes)
   */
  updateContext(context: AssistantContext): void {
    this.context = context
  }

  /**
   * Check if Vapi is available (API key configured)
   */
  isAvailable(): boolean {
    return this.vapi !== null
  }

  /**
   * Check if a session is currently active
   */
  isActive(): boolean {
    return this.currentState === 'active' || this.currentState === 'connecting'
  }
}

/**
 * Singleton instance of VapiService
 */
let vapiServiceInstance: VapiService | null = null

/**
 * Get the VapiService singleton instance
 */
export function getVapiService(): VapiService {
  if (!vapiServiceInstance) {
    vapiServiceInstance = new VapiService()
  }
  return vapiServiceInstance
}

/**
 * Reset the VapiService instance (for testing)
 */
export function resetVapiService(): void {
  if (vapiServiceInstance) {
    vapiServiceInstance.endSession()
  }
  vapiServiceInstance = null
}
