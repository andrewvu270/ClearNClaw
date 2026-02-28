import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: klaw-voice-function-calling
 * 
 * Property tests for the vapi-webhook edge function
 */

// ============================================================================
// Types (mirroring the webhook types for testing)
// ============================================================================

interface VapiWebhookRequest {
  message: {
    type: 'tool-calls' | 'assistant-request' | 'status-update' | 'end-of-call-report'
    toolCalls?: VapiToolCall[]
    call?: {
      id: string
      assistantId?: string
      metadata?: Record<string, unknown>
    }
  }
}

interface VapiToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

// ============================================================================
// Authentication Logic (extracted for testing)
// ============================================================================

interface AuthResult {
  valid: boolean
  status: number
  error?: string
}

/**
 * Validates the Vapi webhook secret header
 */
function validateVapiSecret(
  providedSecret: string | null | undefined,
  expectedSecret: string | null | undefined
): AuthResult {
  if (!expectedSecret) {
    return { valid: false, status: 500, error: 'Server configuration error' }
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return { valid: false, status: 401, error: 'Unauthorized' }
  }
  return { valid: true, status: 200 }
}

/**
 * Extracts and validates userId from call metadata
 */
function extractUserId(request: VapiWebhookRequest): { userId: string | null; error?: string } {
  const userId = request.message.call?.metadata?.userId as string | undefined
  if (!userId) {
    return { userId: null, error: 'Missing userId in call metadata' }
  }
  return { userId }
}

/**
 * Full authentication check combining secret and userId validation
 */
function authenticateRequest(
  providedSecret: string | null | undefined,
  expectedSecret: string | null | undefined,
  request: VapiWebhookRequest
): AuthResult & { userId?: string } {
  // First validate the secret
  const secretResult = validateVapiSecret(providedSecret, expectedSecret)
  if (!secretResult.valid) {
    return secretResult
  }

  // Then extract userId
  const { userId, error } = extractUserId(request)
  if (!userId) {
    return { valid: false, status: 400, error }
  }

  return { valid: true, status: 200, userId }
}

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

const secretArb = fc.string({ minLength: 16, maxLength: 64 })

const toolCallArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('function' as const),
  function: fc.record({
    name: fc.constantFrom('createTask', 'completeTask', 'listTasks', 'deleteTask'),
    arguments: fc.dictionary(fc.string(), fc.jsonValue()),
  }),
})

const requestWithoutUserIdArb: fc.Arbitrary<VapiWebhookRequest> = fc.record({
  message: fc.record({
    type: fc.constant('tool-calls' as const),
    toolCalls: fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
    call: fc.option(
      fc.record({
        id: fc.uuid(),
        assistantId: fc.option(fc.uuid(), { nil: undefined }),
        metadata: fc.option(fc.dictionary(fc.string().filter(s => s !== 'userId'), fc.jsonValue()), { nil: undefined }),
      }),
      { nil: undefined }
    ),
  }),
})

// ============================================================================
// Property Tests
// ============================================================================

describe('Vapi Webhook Authentication', () => {
  /**
   * Property 4: Authentication rejects invalid requests
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  describe('Property 4: Authentication rejects invalid requests', () => {
    it('rejects requests with missing secret', () => {
      fc.assert(
        fc.property(
          secretArb,
          fc.uuid(),
          (expectedSecret, userId) => {
            const request = {
              message: {
                type: 'tool-calls' as const,
                toolCalls: [],
                call: { id: 'call-1', metadata: { userId } },
              },
            }

            // Test with null secret
            const resultNull = authenticateRequest(null, expectedSecret, request)
            expect(resultNull.valid).toBe(false)
            expect(resultNull.status).toBe(401)
            expect(resultNull.error).toBe('Unauthorized')

            // Test with undefined secret
            const resultUndefined = authenticateRequest(undefined, expectedSecret, request)
            expect(resultUndefined.valid).toBe(false)
            expect(resultUndefined.status).toBe(401)
            expect(resultUndefined.error).toBe('Unauthorized')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects requests with wrong secret', () => {
      fc.assert(
        fc.property(
          secretArb,
          secretArb.filter(s => s.length > 0),
          fc.uuid(),
          (expectedSecret, wrongSecret, userId) => {
            // Ensure the secrets are different
            if (expectedSecret === wrongSecret) return true

            const request = {
              message: {
                type: 'tool-calls' as const,
                toolCalls: [],
                call: { id: 'call-1', metadata: { userId } },
              },
            }

            const result = authenticateRequest(wrongSecret, expectedSecret, request)
            expect(result.valid).toBe(false)
            expect(result.status).toBe(401)
            expect(result.error).toBe('Unauthorized')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects requests with missing userId in metadata', () => {
      fc.assert(
        fc.property(
          secretArb,
          requestWithoutUserIdArb,
          (secret, request) => {
            const result = authenticateRequest(secret, secret, request)
            expect(result.valid).toBe(false)
            expect(result.status).toBe(400)
            expect(result.error).toBe('Missing userId in call metadata')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('accepts requests with valid secret and userId', () => {
      fc.assert(
        fc.property(
          secretArb,
          fc.uuid(),
          (secret, userId) => {
            const request = {
              message: {
                type: 'tool-calls' as const,
                toolCalls: [],
                call: { id: 'call-1', metadata: { userId } },
              },
            }

            const result = authenticateRequest(secret, secret, request)
            expect(result.valid).toBe(true)
            expect(result.status).toBe(200)
            expect(result.userId).toBe(userId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns 500 when server secret is not configured', () => {
      fc.assert(
        fc.property(
          fc.option(secretArb, { nil: null }),
          fc.uuid(),
          (providedSecret, userId) => {
            const request = {
              message: {
                type: 'tool-calls' as const,
                toolCalls: [],
                call: { id: 'call-1', metadata: { userId } },
              },
            }

            // Test with null expected secret (server misconfiguration)
            const resultNull = authenticateRequest(providedSecret, null, request)
            expect(resultNull.valid).toBe(false)
            expect(resultNull.status).toBe(500)
            expect(resultNull.error).toBe('Server configuration error')

            // Test with undefined expected secret
            const resultUndefined = authenticateRequest(providedSecret, undefined, request)
            expect(resultUndefined.valid).toBe(false)
            expect(resultUndefined.status).toBe(500)
            expect(resultUndefined.error).toBe('Server configuration error')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('validates userId is scoped to the authenticated user', () => {
      fc.assert(
        fc.property(
          secretArb,
          fc.uuid(),
          (secret, expectedUserId) => {
            const request = {
              message: {
                type: 'tool-calls' as const,
                toolCalls: [],
                call: { id: 'call-1', metadata: { userId: expectedUserId } },
              },
            }

            const result = authenticateRequest(secret, secret, request)
            
            // The extracted userId should match what was in the metadata
            expect(result.valid).toBe(true)
            expect(result.userId).toBe(expectedUserId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Secret validation edge cases', () => {
    it('treats empty string secret as invalid', () => {
      const result = validateVapiSecret('', 'valid-secret')
      expect(result.valid).toBe(false)
      expect(result.status).toBe(401)
    })

    it('is case-sensitive for secret comparison', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 32 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
          (secret) => {
            const upperSecret = secret.toUpperCase()
            const lowerSecret = secret.toLowerCase()
            
            if (upperSecret === lowerSecret) return true

            const result = validateVapiSecret(upperSecret, lowerSecret)
            expect(result.valid).toBe(false)
            expect(result.status).toBe(401)

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('UserId extraction edge cases', () => {
    it('handles missing call object', () => {
      const request: VapiWebhookRequest = {
        message: {
          type: 'tool-calls',
          toolCalls: [],
        },
      }

      const result = extractUserId(request)
      expect(result.userId).toBeNull()
      expect(result.error).toBe('Missing userId in call metadata')
    })

    it('handles missing metadata object', () => {
      const request: VapiWebhookRequest = {
        message: {
          type: 'tool-calls',
          toolCalls: [],
          call: { id: 'call-1' },
        },
      }

      const result = extractUserId(request)
      expect(result.userId).toBeNull()
      expect(result.error).toBe('Missing userId in call metadata')
    })

    it('handles empty metadata object', () => {
      const request: VapiWebhookRequest = {
        message: {
          type: 'tool-calls',
          toolCalls: [],
          call: { id: 'call-1', metadata: {} },
        },
      }

      const result = extractUserId(request)
      expect(result.userId).toBeNull()
      expect(result.error).toBe('Missing userId in call metadata')
    })
  })
})

// ============================================================================
// Task Mutation Function Logic (extracted for testing)
// ============================================================================

interface FunctionResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
}

interface TaskData {
  id: string
  name: string
  emoji: string
  completed: boolean
  subtasks: SubtaskData[]
}

interface SubtaskData {
  id: string
  name: string
  completed: boolean
  sortOrder: number
}

/**
 * Validates createTask arguments and returns appropriate response structure
 */
function validateCreateTaskArgs(args: { description?: string; confirmed?: boolean }): FunctionResult {
  if (!args.description) {
    return {
      success: false,
      message: 'What task would you like to create?',
    }
  }

  if (!args.confirmed) {
    return {
      success: false,
      message: `Should I create a task called "${args.description}"?`,
    }
  }

  return {
    success: true,
    message: 'Valid arguments',
  }
}

/**
 * Validates completeTask arguments
 */
function validateCompleteTaskArgs(args: { taskName?: string }): FunctionResult {
  if (!args.taskName) {
    return {
      success: false,
      message: 'Which task do you want to complete?',
    }
  }

  return {
    success: true,
    message: 'Valid arguments',
  }
}

/**
 * Validates deleteTask arguments
 */
function validateDeleteTaskArgs(args: { taskName?: string; confirmed?: boolean }): FunctionResult {
  if (!args.taskName) {
    return {
      success: false,
      message: 'Which task do you want to delete?',
    }
  }

  return {
    success: true,
    message: 'Valid arguments',
  }
}

/**
 * Simulates task lookup result handling
 */
function handleTaskLookupResult(
  tasks: TaskData[] | null,
  taskName: string,
  operation: 'complete' | 'delete'
): FunctionResult {
  if (!tasks || tasks.length === 0) {
    return {
      success: false,
      error: 'task_not_found',
      message: `Couldn't find a task matching "${taskName}".`,
    }
  }

  if (tasks.length > 1) {
    const taskNames = tasks.map(t => t.name).join(', ')
    return {
      success: false,
      error: 'disambiguation_needed',
      data: { matches: tasks.map(t => ({ id: t.id, name: t.name })) },
      message: `Found multiple tasks: ${taskNames}. Which one?`,
    }
  }

  return {
    success: true,
    data: { task: tasks[0] },
    message: `Found task for ${operation}`,
  }
}

/**
 * Formats successful task creation response
 */
function formatCreateTaskResponse(
  taskId: string,
  description: string,
  emoji: string,
  subtaskCount: number
): FunctionResult {
  return {
    success: true,
    data: {
      taskId,
      name: description,
      emoji,
      subtaskCount,
    },
    message: `Created "${description}" with ${subtaskCount} subtasks.`,
  }
}

/**
 * Formats successful task completion response
 */
function formatCompleteTaskResponse(taskId: string, taskName: string): FunctionResult {
  return {
    success: true,
    data: { taskId, name: taskName },
    message: `Boom! "${taskName}" is done!`,
  }
}

/**
 * Formats successful task deletion response
 */
function formatDeleteTaskResponse(taskId: string, taskName: string): FunctionResult {
  return {
    success: true,
    data: { taskId, name: taskName },
    message: `Deleted "${taskName}".`,
  }
}

// ============================================================================
// Query Function Logic (extracted for testing)
// ============================================================================

/**
 * Formats task list for voice response
 */
function formatTaskListResponse(tasks: TaskData[]): FunctionResult {
  if (tasks.length === 0) {
    return {
      success: true,
      data: { tasks: [] },
      message: "You don't have any active tasks. Want to create one?",
    }
  }

  const taskSummaries = tasks.map(t => {
    const completedCount = t.subtasks.filter(s => s.completed).length
    const totalCount = t.subtasks.length
    return {
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      progress: `${completedCount}/${totalCount}`,
    }
  })

  const taskList = taskSummaries.map(t => t.name).join(', ')

  return {
    success: true,
    data: { tasks: taskSummaries },
    message: `You have ${tasks.length} active task${tasks.length === 1 ? '' : 's'}: ${taskList}.`,
  }
}

/**
 * Finds the next incomplete subtask across tasks
 */
function findNextSubtask(tasks: TaskData[]): FunctionResult {
  if (tasks.length === 0) {
    return {
      success: true,
      data: { nextSubtask: null },
      message: "You don't have any active tasks. Want to create one?",
    }
  }

  for (const task of tasks) {
    const sortedSubtasks = [...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder)
    const nextSubtask = sortedSubtasks.find(s => !s.completed)
    if (nextSubtask) {
      return {
        success: true,
        data: {
          nextSubtask: {
            id: nextSubtask.id,
            name: nextSubtask.name,
            taskName: task.name,
          },
        },
        message: `Next up: "${nextSubtask.name}" from "${task.name}".`,
      }
    }
  }

  return {
    success: true,
    data: { nextSubtask: null },
    message: `Looks like you've finished all your subtasks! Want to mark a task complete?`,
  }
}

/**
 * Formats task details for voice response
 */
function formatTaskDetailsResponse(task: TaskData): FunctionResult {
  const sortedSubtasks = [...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder)
  const completedCount = sortedSubtasks.filter(s => s.completed).length
  const totalCount = sortedSubtasks.length
  const incompleteSubtasks = sortedSubtasks.filter(s => !s.completed).map(s => s.name)

  let message = `"${task.name}" has ${completedCount} of ${totalCount} subtasks done.`
  if (incompleteSubtasks.length > 0 && incompleteSubtasks.length <= 3) {
    message += ` Remaining: ${incompleteSubtasks.join(', ')}.`
  } else if (incompleteSubtasks.length > 3) {
    message += ` ${incompleteSubtasks.length} subtasks left.`
  }

  return {
    success: true,
    data: {
      task: {
        id: task.id,
        name: task.name,
        emoji: task.emoji,
        completed: task.completed,
        subtasks: sortedSubtasks.map(s => ({
          id: s.id,
          name: s.name,
          completed: s.completed,
        })),
      },
    },
    message,
  }
}

// ============================================================================
// Arbitraries for Task Data
// ============================================================================

const taskNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
const emojiArb = fc.constantFrom('📝', '🎯', '💪', '🚀', '✨', '🔥', '💡', '🎮')

const subtaskArb: fc.Arbitrary<SubtaskData> = fc.record({
  id: fc.uuid(),
  name: taskNameArb,
  completed: fc.boolean(),
  sortOrder: fc.nat({ max: 100 }),
})

const taskArb: fc.Arbitrary<TaskData> = fc.record({
  id: fc.uuid(),
  name: taskNameArb,
  emoji: emojiArb,
  completed: fc.constant(false), // Active tasks only
  subtasks: fc.array(subtaskArb, { minLength: 0, maxLength: 10 }),
})

const activeTaskArb: fc.Arbitrary<TaskData> = fc.record({
  id: fc.uuid(),
  name: taskNameArb,
  emoji: emojiArb,
  completed: fc.constant(false),
  subtasks: fc.array(subtaskArb, { minLength: 1, maxLength: 5 }),
})

// ============================================================================
// Property Tests for Task Mutation Functions
// ============================================================================

describe('Task Mutation Functions', () => {
  /**
   * Property 1: Task mutation functions execute correctly through webhook
   * Validates: Requirements 1.2, 1.3, 4.1, 4.2
   */
  describe('Property 1: Task mutation functions execute correctly through webhook', () => {
    it('createTask requires description and confirmation', () => {
      fc.assert(
        fc.property(
          fc.record({
            description: fc.option(taskNameArb, { nil: undefined }),
            confirmed: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (args) => {
            const result = validateCreateTaskArgs(args)

            if (!args.description) {
              expect(result.success).toBe(false)
              expect(result.message).toBe('What task would you like to create?')
            } else if (!args.confirmed) {
              expect(result.success).toBe(false)
              expect(result.message).toContain('Should I create a task called')
            } else {
              expect(result.success).toBe(true)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('createTask response contains all required fields', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          taskNameArb,
          emojiArb,
          fc.nat({ max: 10 }),
          (taskId, description, emoji, subtaskCount) => {
            const result = formatCreateTaskResponse(taskId, description, emoji, subtaskCount)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            
            const data = result.data as { taskId: string; name: string; emoji: string; subtaskCount: number }
            expect(data.taskId).toBe(taskId)
            expect(data.name).toBe(description)
            expect(data.emoji).toBe(emoji)
            expect(data.subtaskCount).toBe(subtaskCount)
            expect(result.message).toContain(description)
            expect(result.message).toContain(`${subtaskCount} subtasks`)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('completeTask requires taskName', () => {
      fc.assert(
        fc.property(
          fc.record({
            taskName: fc.option(taskNameArb, { nil: undefined }),
          }),
          (args) => {
            const result = validateCompleteTaskArgs(args)

            if (!args.taskName) {
              expect(result.success).toBe(false)
              expect(result.message).toBe('Which task do you want to complete?')
            } else {
              expect(result.success).toBe(true)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('completeTask response contains task info', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          taskNameArb,
          (taskId, taskName) => {
            const result = formatCompleteTaskResponse(taskId, taskName)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            
            const data = result.data as { taskId: string; name: string }
            expect(data.taskId).toBe(taskId)
            expect(data.name).toBe(taskName)
            expect(result.message).toContain(taskName)
            expect(result.message).toContain('done')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('deleteTask requires taskName', () => {
      fc.assert(
        fc.property(
          fc.record({
            taskName: fc.option(taskNameArb, { nil: undefined }),
            confirmed: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (args) => {
            const result = validateDeleteTaskArgs(args)

            if (!args.taskName) {
              expect(result.success).toBe(false)
              expect(result.message).toBe('Which task do you want to delete?')
            } else {
              expect(result.success).toBe(true)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('deleteTask response contains task info', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          taskNameArb,
          (taskId, taskName) => {
            const result = formatDeleteTaskResponse(taskId, taskName)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            
            const data = result.data as { taskId: string; name: string }
            expect(data.taskId).toBe(taskId)
            expect(data.name).toBe(taskName)
            expect(result.message).toContain(taskName)
            expect(result.message).toContain('Deleted')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('task lookup handles not found correctly', () => {
      fc.assert(
        fc.property(
          taskNameArb,
          fc.constantFrom('complete', 'delete') as fc.Arbitrary<'complete' | 'delete'>,
          (taskName, operation) => {
            // Empty array = not found
            const result = handleTaskLookupResult([], taskName, operation)

            expect(result.success).toBe(false)
            expect(result.error).toBe('task_not_found')
            expect(result.message).toContain(taskName)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('task lookup handles disambiguation correctly', () => {
      fc.assert(
        fc.property(
          fc.array(taskArb, { minLength: 2, maxLength: 5 }),
          taskNameArb,
          fc.constantFrom('complete', 'delete') as fc.Arbitrary<'complete' | 'delete'>,
          (tasks, taskName, operation) => {
            const result = handleTaskLookupResult(tasks, taskName, operation)

            expect(result.success).toBe(false)
            expect(result.error).toBe('disambiguation_needed')
            expect(result.data).toBeDefined()
            
            const data = result.data as { matches: { id: string; name: string }[] }
            expect(data.matches.length).toBe(tasks.length)
            expect(result.message).toContain('Which one?')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('task lookup handles single match correctly', () => {
      fc.assert(
        fc.property(
          taskArb,
          taskNameArb,
          fc.constantFrom('complete', 'delete') as fc.Arbitrary<'complete' | 'delete'>,
          (task, taskName, operation) => {
            const result = handleTaskLookupResult([task], taskName, operation)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            
            const data = result.data as { task: TaskData }
            expect(data.task.id).toBe(task.id)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================================================
// Property Tests for Query Functions
// ============================================================================

describe('Query Functions', () => {
  /**
   * Property 2: Query functions return accurate task information
   * Validates: Requirements 4.5, 4.6
   */
  describe('Property 2: Query functions return accurate task information', () => {
    it('listTasks returns correct count and names', () => {
      fc.assert(
        fc.property(
          fc.array(activeTaskArb, { minLength: 0, maxLength: 10 }),
          (tasks) => {
            const result = formatTaskListResponse(tasks)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()

            const data = result.data as { tasks: { id: string; name: string; progress: string }[] }
            expect(data.tasks.length).toBe(tasks.length)

            if (tasks.length === 0) {
              expect(result.message).toContain("don't have any active tasks")
            } else {
              expect(result.message).toContain(`${tasks.length} active task`)
              // All task names should be in the message
              for (const task of tasks) {
                expect(result.message).toContain(task.name)
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('listTasks calculates progress correctly', () => {
      fc.assert(
        fc.property(
          activeTaskArb,
          (task) => {
            const result = formatTaskListResponse([task])

            const data = result.data as { tasks: { progress: string }[] }
            const completedCount = task.subtasks.filter(s => s.completed).length
            const totalCount = task.subtasks.length

            expect(data.tasks[0].progress).toBe(`${completedCount}/${totalCount}`)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getNextSubtask finds first incomplete subtask by sort order', () => {
      fc.assert(
        fc.property(
          fc.array(activeTaskArb, { minLength: 1, maxLength: 5 }),
          (tasks) => {
            const result = findNextSubtask(tasks)

            expect(result.success).toBe(true)

            // Find expected next subtask manually
            let expectedNext: { id: string; name: string; taskName: string } | null = null
            for (const task of tasks) {
              const sorted = [...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder)
              const incomplete = sorted.find(s => !s.completed)
              if (incomplete) {
                expectedNext = {
                  id: incomplete.id,
                  name: incomplete.name,
                  taskName: task.name,
                }
                break
              }
            }

            const data = result.data as { nextSubtask: { id: string; name: string; taskName: string } | null }

            if (expectedNext) {
              expect(data.nextSubtask).not.toBeNull()
              expect(data.nextSubtask!.id).toBe(expectedNext.id)
              expect(data.nextSubtask!.name).toBe(expectedNext.name)
              expect(data.nextSubtask!.taskName).toBe(expectedNext.taskName)
            } else {
              expect(data.nextSubtask).toBeNull()
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getNextSubtask handles empty task list', () => {
      const result = findNextSubtask([])

      expect(result.success).toBe(true)
      const data = result.data as { nextSubtask: null }
      expect(data.nextSubtask).toBeNull()
      expect(result.message).toContain("don't have any active tasks")
    })

    it('getTaskDetails returns accurate subtask counts', () => {
      fc.assert(
        fc.property(
          activeTaskArb,
          (task) => {
            const result = formatTaskDetailsResponse(task)

            expect(result.success).toBe(true)

            const completedCount = task.subtasks.filter(s => s.completed).length
            const totalCount = task.subtasks.length

            expect(result.message).toContain(`${completedCount} of ${totalCount}`)
            expect(result.message).toContain(task.name)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getTaskDetails lists remaining subtasks when 3 or fewer', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            name: taskNameArb,
            emoji: emojiArb,
            completed: fc.constant(false),
            subtasks: fc.array(
              fc.record({
                id: fc.uuid(),
                name: taskNameArb,
                completed: fc.constant(false), // All incomplete
                sortOrder: fc.nat({ max: 100 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          (task) => {
            const result = formatTaskDetailsResponse(task)

            // Should list remaining subtasks
            expect(result.message).toContain('Remaining:')
            for (const subtask of task.subtasks) {
              expect(result.message).toContain(subtask.name)
            }

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('getTaskDetails shows count when more than 3 remaining', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            name: taskNameArb,
            emoji: emojiArb,
            completed: fc.constant(false),
            subtasks: fc.array(
              fc.record({
                id: fc.uuid(),
                name: taskNameArb,
                completed: fc.constant(false), // All incomplete
                sortOrder: fc.nat({ max: 100 }),
              }),
              { minLength: 4, maxLength: 10 }
            ),
          }),
          (task) => {
            const result = formatTaskDetailsResponse(task)

            // Should show count instead of listing
            expect(result.message).toContain(`${task.subtasks.length} subtasks left`)
            expect(result.message).not.toContain('Remaining:')

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('getTaskDetails returns subtasks in sorted order', () => {
      fc.assert(
        fc.property(
          activeTaskArb,
          (task) => {
            const result = formatTaskDetailsResponse(task)

            const data = result.data as { task: { subtasks: { id: string; name: string; completed: boolean }[] } }
            
            // Verify subtasks are sorted by sortOrder
            const expectedOrder = [...task.subtasks]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(s => s.id)
            
            const actualOrder = data.task.subtasks.map(s => s.id)
            
            expect(actualOrder).toEqual(expectedOrder)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================================================
// Error Handling Logic (extracted for testing)
// ============================================================================

type ErrorType = 'task_not_found' | 'subtask_not_found' | 'disambiguation_needed' | 'invalid_input' | 'database_error' | 'unknown_error'

interface ErrorFunctionResult {
  success: boolean
  data?: unknown
  error?: ErrorType
  message: string
}

/**
 * Creates a task-not-found error response with helpful message for Klaw to speak
 */
function taskNotFoundError(taskName: string): ErrorFunctionResult {
  return {
    success: false,
    error: 'task_not_found',
    message: `Couldn't find a task matching "${taskName}". Try saying the full task name or ask me to list your tasks.`,
  }
}

/**
 * Creates a subtask-not-found error response
 */
function subtaskNotFoundError(subtaskName: string): ErrorFunctionResult {
  return {
    success: false,
    error: 'subtask_not_found',
    message: `Couldn't find a subtask matching "${subtaskName}". Try saying the full subtask name.`,
  }
}

/**
 * Creates a disambiguation error response when multiple tasks match
 */
function disambiguationError(matches: { id: string; name: string }[], itemType: 'task' | 'subtask' = 'task'): ErrorFunctionResult {
  const names = matches.map(m => m.name).join(', ')
  return {
    success: false,
    error: 'disambiguation_needed',
    data: { matches },
    message: `Found multiple ${itemType}s: ${names}. Which one did you mean?`,
  }
}

/**
 * Creates a database error response with user-friendly message
 */
function databaseError(operation: string): ErrorFunctionResult {
  return {
    success: false,
    error: 'database_error',
    message: `Had trouble ${operation}. Want to try again?`,
  }
}

/**
 * Creates an invalid input error response
 */
function invalidInputError(message: string): ErrorFunctionResult {
  return {
    success: false,
    error: 'invalid_input',
    message,
  }
}

/**
 * Simulates the error handling in executeFunction for unknown functions
 */
function handleUnknownFunction(functionName: string): ErrorFunctionResult {
  return invalidInputError(`I don't know how to do "${functionName}". Try asking me to create, complete, or list tasks.`)
}

/**
 * Simulates general error handling for caught exceptions
 */
function handleCaughtError(error: Error, functionName: string): ErrorFunctionResult {
  const errorMessage = error.message
  if (errorMessage.includes('database') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
    return databaseError(`with ${functionName}`)
  }
  return {
    success: false,
    error: 'unknown_error',
    message: 'Something went wrong. Want to try again?',
  }
}

// ============================================================================
// Property Tests for Error Handling
// ============================================================================

describe('Error Handling', () => {
  /**
   * Property 3: Error handling returns structured responses
   * Validates: Requirements 5.1, 5.3, 5.4, 6.4
   * 
   * Feature: klaw-voice-function-calling, Property 3: Error handling returns structured responses
   */
  describe('Property 3: Error handling returns structured responses', () => {
    it('task-not-found errors have consistent structure', () => {
      fc.assert(
        fc.property(
          taskNameArb,
          (taskName) => {
            const result = taskNotFoundError(taskName)

            // Verify structure
            expect(result.success).toBe(false)
            expect(result.error).toBe('task_not_found')
            expect(typeof result.message).toBe('string')
            
            // Verify message is helpful for Klaw to speak
            expect(result.message).toContain(taskName)
            expect(result.message.length).toBeGreaterThan(0)
            
            // Verify message includes helpful guidance
            expect(result.message).toMatch(/try|ask|list/i)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('subtask-not-found errors have consistent structure', () => {
      fc.assert(
        fc.property(
          taskNameArb,
          (subtaskName) => {
            const result = subtaskNotFoundError(subtaskName)

            // Verify structure
            expect(result.success).toBe(false)
            expect(result.error).toBe('subtask_not_found')
            expect(typeof result.message).toBe('string')
            
            // Verify message contains the subtask name
            expect(result.message).toContain(subtaskName)
            expect(result.message.length).toBeGreaterThan(0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('disambiguation errors include all matching items', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: taskNameArb,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.constantFrom('task', 'subtask') as fc.Arbitrary<'task' | 'subtask'>,
          (matches, itemType) => {
            const result = disambiguationError(matches, itemType)

            // Verify structure
            expect(result.success).toBe(false)
            expect(result.error).toBe('disambiguation_needed')
            expect(result.data).toBeDefined()
            
            // Verify data contains all matches
            const data = result.data as { matches: { id: string; name: string }[] }
            expect(data.matches.length).toBe(matches.length)
            
            // Verify all match IDs are present
            const matchIds = new Set(matches.map(m => m.id))
            const resultIds = new Set(data.matches.map(m => m.id))
            expect(resultIds).toEqual(matchIds)
            
            // Verify message mentions the item type
            expect(result.message).toContain(itemType)
            
            // Verify message asks for clarification
            expect(result.message).toMatch(/which one/i)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('database errors have user-friendly messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'creating that task',
            'completing that task',
            'deleting that task',
            'finding that task',
            'getting your tasks',
            'setting that reminder'
          ),
          (operation) => {
            const result = databaseError(operation)

            // Verify structure
            expect(result.success).toBe(false)
            expect(result.error).toBe('database_error')
            expect(typeof result.message).toBe('string')
            
            // Verify message is user-friendly (no technical jargon)
            expect(result.message).not.toMatch(/exception|error|failed|null|undefined/i)
            
            // Verify message includes the operation context
            expect(result.message).toContain(operation)
            
            // Verify message offers to retry
            expect(result.message).toMatch(/try again/i)

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('invalid input errors have clear messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'What task would you like to create?',
            'Which task do you want to complete?',
            'Which task do you want to delete?',
            'Which task do you want details about?',
            'Which subtask do you want to complete?',
            'When should I remind you?'
          ),
          (message) => {
            const result = invalidInputError(message)

            // Verify structure
            expect(result.success).toBe(false)
            expect(result.error).toBe('invalid_input')
            expect(result.message).toBe(message)
            
            // Verify message is a question (ends with ?)
            expect(result.message).toMatch(/\?$/)

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('unknown function errors provide helpful guidance', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
            !['createTask', 'completeTask', 'deleteTask', 'listTasks', 'getNextSubtask', 
              'getTaskDetails', 'setReminder', 'startTimer', 'pauseTimer', 'resumeTimer', 
              'stopTimer', 'completeSubtask'].includes(s)
          ),
          (unknownFunctionName) => {
            const result = handleUnknownFunction(unknownFunctionName)

            // Verify structure
            expect(result.success).toBe(false)
            expect(result.error).toBe('invalid_input')
            
            // Verify message mentions the unknown function
            expect(result.message).toContain(unknownFunctionName)
            
            // Verify message provides guidance
            expect(result.message).toMatch(/create|complete|list/i)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('caught database-related errors return database_error type', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('database connection failed', 'connection timeout', 'database timeout'),
          fc.constantFrom('createTask', 'completeTask', 'deleteTask'),
          (errorMessage, functionName) => {
            const error = new Error(errorMessage)
            const result = handleCaughtError(error, functionName)

            expect(result.success).toBe(false)
            expect(result.error).toBe('database_error')
            expect(result.message).toContain(functionName)

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('caught non-database errors return unknown_error type', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
            !s.includes('database') && !s.includes('connection') && !s.includes('timeout')
          ),
          fc.constantFrom('createTask', 'completeTask', 'deleteTask'),
          (errorMessage, functionName) => {
            const error = new Error(errorMessage)
            const result = handleCaughtError(error, functionName)

            expect(result.success).toBe(false)
            expect(result.error).toBe('unknown_error')
            expect(result.message).toMatch(/try again/i)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('all error responses have success=false', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            () => taskNotFoundError('test task'),
            () => subtaskNotFoundError('test subtask'),
            () => disambiguationError([{ id: '1', name: 'task1' }, { id: '2', name: 'task2' }]),
            () => databaseError('testing'),
            () => invalidInputError('test message'),
            () => handleUnknownFunction('unknownFunc'),
            () => handleCaughtError(new Error('test'), 'testFunc')
          ),
          (errorFn) => {
            const result = errorFn()
            expect(result.success).toBe(false)
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('all error responses have non-empty messages', () => {
      fc.assert(
        fc.property(
          taskNameArb,
          (name) => {
            const errors = [
              taskNotFoundError(name),
              subtaskNotFoundError(name),
              disambiguationError([{ id: '1', name }]),
              databaseError('testing'),
              invalidInputError('test?'),
              handleUnknownFunction(name),
            ]

            for (const error of errors) {
              expect(error.message).toBeDefined()
              expect(error.message.length).toBeGreaterThan(0)
              expect(typeof error.message).toBe('string')
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('error types are from the defined set', () => {
      const validErrorTypes: ErrorType[] = [
        'task_not_found',
        'subtask_not_found', 
        'disambiguation_needed',
        'invalid_input',
        'database_error',
        'unknown_error'
      ]

      fc.assert(
        fc.property(
          taskNameArb,
          (name) => {
            const errors = [
              taskNotFoundError(name),
              subtaskNotFoundError(name),
              disambiguationError([{ id: '1', name }]),
              databaseError('testing'),
              invalidInputError('test?'),
              handleUnknownFunction(name),
              handleCaughtError(new Error('test'), 'func'),
            ]

            for (const error of errors) {
              if (error.error) {
                expect(validErrorTypes).toContain(error.error)
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
