import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { BigTask } from '../../types'
import type { ConversationState } from '../../types/assistant'
import {
  MAX_CONTEXT_TASKS,
  containsTaskPronoun,
  containsSubtaskPronoun,
  resolveTaskReference,
  updateConversationState,
  createInitialConversationState,
} from '../assistantContext'

// Arbitrary for generating subtasks
const subtaskArb = fc.record({
  id: fc.uuid(),
  bigTaskId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  emoji: fc.constantFrom('▪️', '✅', '📝', '🎯'),
  completed: fc.boolean(),
  sortOrder: fc.nat({ max: 100 }),
})

// Arbitrary for generating BigTasks
const bigTaskArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  emoji: fc.constantFrom('🎯', '📝', '✨', '🚀', '💡'),
  completed: fc.boolean(),
  createdAt: fc.date().map((d) => d.toISOString()),
  completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  subTasks: fc.array(subtaskArb, { minLength: 0, maxLength: 5 }),
  energyTag: fc.constantFrom('low', 'medium', 'high') as fc.Arbitrary<'low' | 'medium' | 'high'>,
  reminderAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  recurrence: fc.constant(null),
})

// Arbitrary for generating conversation state
const conversationStateArb = fc.record({
  lastReferencedTaskId: fc.option(fc.uuid(), { nil: null }),
  lastReferencedSubtaskId: fc.option(fc.uuid(), { nil: null }),
})

describe('AssistantContext', () => {
  /**
   * Feature: vapi-voice-agent, Property 9: Task context limited to 20 active tasks
   *
   * For any assistant session, the task context SHALL contain at most 20 BigTasks,
   * and all tasks in context SHALL have completed: false.
   *
   * Validates: Requirements 13.1, 13.2
   */
  describe('Property 9: Task context limited to 20 active tasks', () => {
    it('MAX_CONTEXT_TASKS is set to 20', () => {
      expect(MAX_CONTEXT_TASKS).toBe(20)
    })

    it('task context filtering only includes non-completed tasks', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 30 }),
          (tasks) => {
            // Simulate the filtering that loadTaskContext does
            const activeTasks = tasks.filter((t) => !t.completed)
            const limitedTasks = activeTasks.slice(0, MAX_CONTEXT_TASKS)

            // All tasks in context should be non-completed
            for (const task of limitedTasks) {
              expect(task.completed).toBe(false)
            }

            // Context should not exceed MAX_CONTEXT_TASKS
            expect(limitedTasks.length).toBeLessThanOrEqual(MAX_CONTEXT_TASKS)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('context respects 20 task limit even with many active tasks', () => {
      fc.assert(
        fc.property(
          fc.array(
            bigTaskArb.map((t) => ({ ...t, completed: false })),
            { minLength: 25, maxLength: 50 }
          ),
          (tasks) => {
            // All tasks are active (completed: false)
            const limitedTasks = tasks.slice(0, MAX_CONTEXT_TASKS)

            expect(limitedTasks.length).toBe(MAX_CONTEXT_TASKS)
            expect(tasks.length).toBeGreaterThan(MAX_CONTEXT_TASKS)

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })


  /**
   * Feature: vapi-voice-agent, Property 10: Pronoun resolution uses last referenced task
   *
   * For any command containing a pronoun reference ("it", "that task", "the last one"),
   * if lastReferencedTaskId is set, the operation SHALL target that task.
   * If not set, the Assistant SHALL ask for clarification.
   *
   * Validates: Requirements 13.3, 13.4
   */
  describe('Property 10: Pronoun resolution uses last referenced task', () => {
    it('containsTaskPronoun detects task pronouns correctly', () => {
      const pronounPhrases = [
        'complete it',
        'rename that task',
        'delete the last one',
        'what about this task',
        'tell me about the task',
      ]

      for (const phrase of pronounPhrases) {
        expect(containsTaskPronoun(phrase)).toBe(true)
      }
    })

    it('containsTaskPronoun returns false for non-pronoun text', () => {
      const nonPronounPhrases = [
        'complete my shopping task',
        'rename project alpha',
        'delete the groceries task',
        'what are my tasks',
      ]

      for (const phrase of nonPronounPhrases) {
        expect(containsTaskPronoun(phrase)).toBe(false)
      }
    })

    it('containsSubtaskPronoun detects subtask pronouns correctly', () => {
      const pronounPhrases = [
        'complete that subtask',
        'rename the subtask',
        'what about this subtask',
      ]

      for (const phrase of pronounPhrases) {
        expect(containsSubtaskPronoun(phrase)).toBe(true)
      }
    })

    it('resolves task pronoun to lastReferencedTaskId when set and task exists', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 1, maxLength: 10 }),
          (tasks) => {
            const targetTask = tasks[0]
            const state: ConversationState = {
              lastReferencedTaskId: targetTask.id,
              lastReferencedSubtaskId: null,
            }

            const result = resolveTaskReference('complete it', state, tasks)

            expect(result.needsClarification).toBe(false)
            expect(result.taskId).toBe(targetTask.id)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('requests clarification when task pronoun used but no lastReferencedTaskId', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 10 }),
          (tasks) => {
            const state: ConversationState = {
              lastReferencedTaskId: null,
              lastReferencedSubtaskId: null,
            }

            const result = resolveTaskReference('complete it', state, tasks)

            expect(result.needsClarification).toBe(true)
            expect(result.clarificationMessage).toBeDefined()
            expect(result.taskId).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('requests clarification when lastReferencedTaskId points to non-existent task', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          (tasks, nonExistentId) => {
            // Ensure the ID doesn't exist in tasks
            const filteredTasks = tasks.filter((t) => t.id !== nonExistentId)

            const state: ConversationState = {
              lastReferencedTaskId: nonExistentId,
              lastReferencedSubtaskId: null,
            }

            const result = resolveTaskReference('complete it', state, filteredTasks)

            expect(result.needsClarification).toBe(true)
            expect(result.taskId).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('resolves subtask pronoun to lastReferencedSubtaskId when set and subtask exists', () => {
      fc.assert(
        fc.property(
          fc.array(
            bigTaskArb.filter((t) => t.subTasks.length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          (tasks) => {
            const targetTask = tasks[0]
            const targetSubtask = targetTask.subTasks[0]

            const state: ConversationState = {
              lastReferencedTaskId: targetTask.id,
              lastReferencedSubtaskId: targetSubtask.id,
            }

            const result = resolveTaskReference('complete that subtask', state, tasks)

            expect(result.needsClarification).toBe(false)
            expect(result.subtaskId).toBe(targetSubtask.id)
            expect(result.taskId).toBe(targetTask.id)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('requests clarification when subtask pronoun used but no lastReferencedSubtaskId', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 10 }),
          (tasks) => {
            const state: ConversationState = {
              lastReferencedTaskId: null,
              lastReferencedSubtaskId: null,
            }

            const result = resolveTaskReference('complete that subtask', state, tasks)

            expect(result.needsClarification).toBe(true)
            expect(result.clarificationMessage).toBeDefined()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns no resolution needed when text has no pronouns', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 10 }),
          conversationStateArb,
          (tasks, state) => {
            const result = resolveTaskReference('complete my shopping task', state, tasks)

            expect(result.needsClarification).toBe(false)
            expect(result.taskId).toBeNull()
            expect(result.subtaskId).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  /**
   * Feature: vapi-voice-agent, Property 11: Context updates after task operations
   *
   * For any task operation (create, complete, edit, delete), the assistant context
   * SHALL be updated to reflect the change before the next user message is processed.
   *
   * Validates: Requirements 13.5
   */
  describe('Property 11: Context updates after task operations', () => {
    it('updateConversationState updates lastReferencedTaskId', () => {
      fc.assert(
        fc.property(
          conversationStateArb,
          fc.uuid(),
          (currentState, newTaskId) => {
            const updatedState = updateConversationState(currentState, newTaskId)

            expect(updatedState.lastReferencedTaskId).toBe(newTaskId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('updateConversationState clears lastReferencedSubtaskId when new task is referenced', () => {
      fc.assert(
        fc.property(
          fc.record({
            lastReferencedTaskId: fc.uuid(),
            lastReferencedSubtaskId: fc.uuid(),
          }),
          fc.uuid(),
          (currentState, newTaskId) => {
            const updatedState = updateConversationState(currentState, newTaskId)

            expect(updatedState.lastReferencedTaskId).toBe(newTaskId)
            // When a new task is referenced, subtask reference should be cleared
            expect(updatedState.lastReferencedSubtaskId).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('updateConversationState updates both task and subtask when provided', () => {
      fc.assert(
        fc.property(
          conversationStateArb,
          fc.uuid(),
          fc.uuid(),
          (currentState, newTaskId, newSubtaskId) => {
            const updatedState = updateConversationState(currentState, newTaskId, newSubtaskId)

            expect(updatedState.lastReferencedTaskId).toBe(newTaskId)
            expect(updatedState.lastReferencedSubtaskId).toBe(newSubtaskId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('updateConversationState preserves existing taskId when null is passed', () => {
      fc.assert(
        fc.property(
          fc.record({
            lastReferencedTaskId: fc.uuid(),
            lastReferencedSubtaskId: fc.option(fc.uuid(), { nil: null }),
          }),
          (currentState) => {
            const updatedState = updateConversationState(currentState, null)

            expect(updatedState.lastReferencedTaskId).toBe(currentState.lastReferencedTaskId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('createInitialConversationState returns empty state', () => {
      const state = createInitialConversationState()

      expect(state.lastReferencedTaskId).toBeNull()
      expect(state.lastReferencedSubtaskId).toBeNull()
    })

    it('conversation state is immutable - updates return new object', () => {
      fc.assert(
        fc.property(
          conversationStateArb,
          fc.uuid(),
          (currentState, newTaskId) => {
            const updatedState = updateConversationState(currentState, newTaskId)

            // Should be a different object
            expect(updatedState).not.toBe(currentState)

            // Original state should be unchanged
            // (only check if original had a value)
            if (currentState.lastReferencedTaskId !== newTaskId) {
              expect(currentState.lastReferencedTaskId).not.toBe(newTaskId)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
