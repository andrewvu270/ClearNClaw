import Vapi from '@vapi-ai/web'
import type {
  AssistantContext,
  FunctionCall,
  FunctionResult,
  VoiceState,
} from '../types/assistant'
import { LAW_VOICE_SYSTEM_PROMPT } from './assistantPrompt'
import {
  executeFunctionCall,
  type FunctionContext,
  type TimerController,
} from './assistantFunctions'
import { updateContextAfterOperation } from './assistantContext'

/**
 * VapiService - Manages voice session lifecycle with Vapi for Law (voice assistant)
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
          // Assistant speaking - use onResponse
          this.callbacks.onResponse?.(transcript)
        } else {
          // User speaking - use onTranscript
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
        console.log('Tool calls received:', msg)
        const toolCalls = msg.toolCalls as Array<{ function: { name: string; arguments: string } }> | undefined
        if (toolCalls) {
          for (const toolCall of toolCalls) {
            const funcMsg = {
              functionCall: {
                name: toolCall.function.name,
                parameters: JSON.parse(toolCall.function.arguments || '{}'),
              },
            }
            await this.handleFunctionCall(funcMsg)
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
   * Build the assistant configuration for Vapi
   */
  private buildAssistantConfig() {
    // Build task context summary for the system prompt
    const taskSummary =
      this.context && this.context.tasks.length > 0
        ? `\n\nCurrent tasks (${this.context.tasks.length}):\n${this.context.tasks
            .map((t) => {
              const done = t.subTasks.filter((st) => st.completed).length
              const total = t.subTasks.length
              return `- ${t.emoji} ${t.name} (${done}/${total} subtasks done)`
            })
            .join('\n')}`
        : '\n\nNo active tasks.'

    const timerInfo = this.context?.timerState
      ? `\n\nTimer: ${this.context.timerState.isRunning ? 'Running' : this.context.timerState.isPaused ? 'Paused' : 'Idle'}, ${Math.ceil(this.context.timerState.remainingSeconds / 60)} min remaining`
      : ''

    const systemPrompt = LAW_VOICE_SYSTEM_PROMPT + taskSummary + timerInfo

    // Simplified config for Vapi - no function calling for now to debug
    // Function calling will be handled via the system prompt with ACTION tags
    return {
      name: 'Law',
      firstMessage: "Yo! Law here. Ready to crush some tasks? What's up?",
      model: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
      },
      voice: {
        provider: 'vapi',
        voiceId: 'Elliot',
      },
    }
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
      const config = this.buildAssistantConfig()
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
