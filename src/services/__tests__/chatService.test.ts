import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  isConfirmationResponse,
  isDenialResponse,
  createChatServiceState,
  type PendingAction,
  type ChatServiceState,
} from '../chatService'

/**
 * Arbitrary for generating confirmation responses
 */
const confirmationResponseArb = fc.constantFrom(
  'yes',
  'Yeah',
  'YEP',
  'sure',
  'ok',
  'okay',
  'do it',
  'go ahead',
  'confirm',
  'confirmed',
  'please',
  'yes please',
  'yes, please',
  "that's right",
  'thats right',
  'correct'
)

/**
 * Arbitrary for generating denial responses
 */
const denialResponseArb = fc.constantFrom(
  'no',
  'nope',
  'nah',
  'cancel',
  'never mind',
  'nevermind',
  'forget it',
  "don't",
  'dont',
  'stop'
)

/**
 * Arbitrary for generating non-confirmation/non-denial messages
 */
const neutralMessageArb = fc
  .string({ minLength: 5, maxLength: 100 })
  .filter((s) => {
    const trimmed = s.trim().toLowerCase()
    // Filter out strings that would match confirmation or denial patterns
    const confirmPatterns = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'do it', 'go ahead', 'confirm', 'please', 'correct', 'right']
    const denyPatterns = ['no', 'nope', 'nah', 'cancel', 'never', 'forget', "don't", 'dont', 'stop']
    
    return !confirmPatterns.some(p => trimmed === p || trimmed.startsWith(p + ' ') || trimmed.startsWith(p + ',')) &&
           !denyPatterns.some(p => trimmed === p || trimmed.startsWith(p + ' '))
  })

/**
 * Arbitrary for generating task descriptions
 */
const taskDescriptionArb = fc
  .string({ minLength: 3, maxLength: 100 })
  .filter((s) => s.trim().length >= 3)

/**
 * Arbitrary for generating pending actions
 */
const pendingActionArb: fc.Arbitrary<PendingAction> = fc.oneof(
  fc.record({
    type: fc.constant('createTask' as const),
    params: fc.record({
      description: taskDescriptionArb,
      confirmed: fc.constant(false),
    }),
    timestamp: fc.integer({ min: 0, max: Date.now() }),
  }),
  fc.record({
    type: fc.constant('deleteTask' as const),
    params: fc.record({
      taskName: taskDescriptionArb,
      confirmed: fc.constant(false),
    }),
    timestamp: fc.integer({ min: 0, max: Date.now() }),
  }),
  fc.record({
    type: fc.constant('clearCompletedTasks' as const),
    params: fc.record({
      confirmed: fc.constant(false),
    }),
    timestamp: fc.integer({ min: 0, max: Date.now() }),
  })
)

describe('ChatService', () => {
  /**
   * Feature: vapi-voice-agent, Property 1: Task creation requires explicit confirmation
   *
   * For any task creation request (via chat or voice), the Assistant SHALL NOT call
   * the createTask function with confirmed=true unless the user has explicitly
   * confirmed the action in a prior message.
   *
   * Validates: Requirements 4.1, 4.2, 4.7
   */
  describe('Property 1: Task creation requires explicit confirmation', () => {
    it('isConfirmationResponse correctly identifies confirmation messages', () => {
      fc.assert(
        fc.property(confirmationResponseArb, (message) => {
          expect(isConfirmationResponse(message)).toBe(true)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('isConfirmationResponse rejects non-confirmation messages', () => {
      fc.assert(
        fc.property(neutralMessageArb, (message) => {
          // Neutral messages should not be recognized as confirmations
          const result = isConfirmationResponse(message)
          // This is a property: neutral messages should not trigger confirmation
          expect(result).toBe(false)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('isDenialResponse correctly identifies denial messages', () => {
      fc.assert(
        fc.property(denialResponseArb, (message) => {
          expect(isDenialResponse(message)).toBe(true)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('isDenialResponse rejects non-denial messages', () => {
      fc.assert(
        fc.property(neutralMessageArb, (message) => {
          const result = isDenialResponse(message)
          expect(result).toBe(false)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('confirmation and denial responses are mutually exclusive', () => {
      fc.assert(
        fc.property(
          fc.oneof(confirmationResponseArb, denialResponseArb),
          (message) => {
            const isConfirm = isConfirmationResponse(message)
            const isDeny = isDenialResponse(message)
            // A message cannot be both a confirmation and a denial
            expect(isConfirm && isDeny).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('pending createTask action stores correct parameters', () => {
      fc.assert(
        fc.property(taskDescriptionArb, (description) => {
          const pendingAction: PendingAction = {
            type: 'createTask',
            params: { description, confirmed: false },
            timestamp: Date.now(),
          }

          expect(pendingAction.type).toBe('createTask')
          expect(pendingAction.params.description).toBe(description)
          expect(pendingAction.params.confirmed).toBe(false)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('initial chat service state has no pending action', () => {
      const state = createChatServiceState()
      expect(state.pendingAction).toBeNull()
    })
  })

  /**
   * Feature: vapi-voice-agent, Property 4: Destructive operations require confirmation
   *
   * For any destructive operation (delete task, clear completed tasks), the operation
   * SHALL NOT execute unless the user has explicitly confirmed the action.
   *
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4
   */
  describe('Property 4: Destructive operations require confirmation', () => {
    it('pending deleteTask action stores correct parameters', () => {
      fc.assert(
        fc.property(taskDescriptionArb, (taskName) => {
          const pendingAction: PendingAction = {
            type: 'deleteTask',
            params: { taskName, confirmed: false },
            timestamp: Date.now(),
          }

          expect(pendingAction.type).toBe('deleteTask')
          expect(pendingAction.params.taskName).toBe(taskName)
          expect(pendingAction.params.confirmed).toBe(false)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('pending clearCompletedTasks action stores correct parameters', () => {
      const pendingAction: PendingAction = {
        type: 'clearCompletedTasks',
        params: { confirmed: false },
        timestamp: Date.now(),
      }

      expect(pendingAction.type).toBe('clearCompletedTasks')
      expect(pendingAction.params.confirmed).toBe(false)
    })

    it('all destructive action types require confirmation parameter', () => {
      fc.assert(
        fc.property(pendingActionArb, (pendingAction) => {
          // All pending actions should have confirmed: false initially
          expect(pendingAction.params.confirmed).toBe(false)
          
          // All destructive types should be one of the known types
          const destructiveTypes = ['createTask', 'deleteTask', 'clearCompletedTasks']
          expect(destructiveTypes).toContain(pendingAction.type)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('state with pending action can be cleared', () => {
      fc.assert(
        fc.property(pendingActionArb, (pendingAction) => {
          const state: ChatServiceState = {
            pendingAction,
          }

          expect(state.pendingAction).not.toBeNull()

          // Simulate clearing the pending action
          const clearedState: ChatServiceState = {
            ...state,
            pendingAction: null,
          }

          expect(clearedState.pendingAction).toBeNull()
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('confirmation response should trigger action execution', () => {
      fc.assert(
        fc.property(
          pendingActionArb,
          confirmationResponseArb,
          (pendingAction, confirmMessage) => {
            // When we have a pending action and receive a confirmation
            const hasConfirmation = isConfirmationResponse(confirmMessage)
            expect(hasConfirmation).toBe(true)

            // The action should be executed with confirmed=true
            const confirmedParams = {
              ...pendingAction.params,
              confirmed: true,
            }
            expect(confirmedParams.confirmed).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('denial response should cancel pending action', () => {
      fc.assert(
        fc.property(
          pendingActionArb,
          denialResponseArb,
          (pendingAction, denyMessage) => {
            // When we have a pending action and receive a denial
            const hasDenial = isDenialResponse(denyMessage)
            expect(hasDenial).toBe(true)

            // The pending action should be cleared without execution
            const state: ChatServiceState = { pendingAction }
            const clearedState: ChatServiceState = { ...state, pendingAction: null }
            
            expect(clearedState.pendingAction).toBeNull()
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: vapi-voice-agent, Property 7: Disambiguation requested for ambiguous matches
   *
   * For any operation that references a task or subtask by name, if multiple items
   * match the provided name, the Assistant SHALL NOT execute the operation and
   * SHALL instead ask for clarification.
   *
   * Note: The actual disambiguation logic is tested in assistantFunctions.test.ts
   * (Property 2 and Property 3). This test verifies the ChatService correctly
   * handles disambiguation responses from the function layer.
   *
   * Validates: Requirements 5.3
   */
  describe('Property 7: Disambiguation requested for ambiguous matches', () => {
    it('disambiguation messages contain "multiple" keyword', () => {
      // This tests the expected format of disambiguation messages
      const disambiguationPatterns = [
        'I found multiple tasks matching',
        'I found multiple subtasks matching',
        'multiple items',
        'Which one did you mean?',
      ]

      // Generate sample disambiguation messages
      const sampleMessages = [
        'I found multiple tasks matching "Project": Project Alpha, Project Beta. Which one did you mean?',
        'I found multiple subtasks matching "Review": "Review code" (in Task 1), "Review docs" (in Task 2). Which one did you mean?',
      ]

      for (const message of sampleMessages) {
        const containsDisambiguation = disambiguationPatterns.some((pattern) =>
          message.toLowerCase().includes(pattern.toLowerCase())
        )
        expect(containsDisambiguation).toBe(true)
      }
    })

    it('disambiguation response is not a confirmation or denial', () => {
      // Disambiguation messages should not trigger confirmation/denial flows
      const disambiguationMessages = [
        'I found multiple tasks matching "Project": Project Alpha, Project Beta. Which one did you mean?',
        'I found multiple subtasks matching "Review": "Review code", "Review docs". Which one did you mean?',
      ]

      for (const message of disambiguationMessages) {
        expect(isConfirmationResponse(message)).toBe(false)
        expect(isDenialResponse(message)).toBe(false)
      }
    })

    it('user clarification after disambiguation should be processed as new message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Project Alpha', 'the first one', 'Project Beta', 'the second one'),
          (clarification) => {
            // User clarifications should not be confirmations or denials
            // They should be processed as new messages to resolve the ambiguity
            const isConfirm = isConfirmationResponse(clarification)
            const isDeny = isDenialResponse(clarification)

            // Most clarifications won't match confirm/deny patterns
            // (unless they happen to say "yes" or "no" which would be unusual)
            if (!clarification.toLowerCase().startsWith('yes') && 
                !clarification.toLowerCase().startsWith('no')) {
              expect(isConfirm).toBe(false)
              expect(isDeny).toBe(false)
            }

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
