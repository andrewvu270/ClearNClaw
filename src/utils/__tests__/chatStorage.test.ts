import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  saveMessage,
  loadMessages,
  clearMessages,
  getStoredSession,
  updateLastReferencedIds,
  MAX_STORED_MESSAGES,
} from '../chatStorage'
import type { ChatMessage } from '../../types/assistant'

/**
 * Arbitrary for generating valid chat message roles
 */
const roleArb = fc.constantFrom('user' as const, 'assistant' as const)

/**
 * Arbitrary for generating valid chat message content
 */
const contentArb = fc.string({ minLength: 1, maxLength: 500 })

/**
 * Arbitrary for generating valid user IDs
 */
const userIdArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !s.includes(' '))
  .map((s) => s.replace(/[^a-zA-Z0-9_-]/g, '_'))

/**
 * Arbitrary for generating a single chat message
 */
const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  id: fc.uuid(),
  role: roleArb,
  content: contentArb,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  functionCalls: fc.constant(undefined),
})

/**
 * Arbitrary for generating an array of chat messages
 */
const chatMessagesArb = (minLength: number, maxLength: number) =>
  fc.array(chatMessageArb, { minLength, maxLength })

describe('ChatStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  /**
   * Feature: vapi-voice-agent, Property 12: Chat history limited to 50 messages
   *
   * For any stored chat session, the message array SHALL contain at most 50 messages,
   * with oldest messages removed when the limit is exceeded.
   *
   * Validates: Requirements 14.1, 14.2
   */
  describe('Property 12: Chat history limited to 50 messages', () => {
    it('stored messages never exceed MAX_STORED_MESSAGES limit', () => {
      fc.assert(
        fc.property(
          userIdArb,
          chatMessagesArb(1, 100), // Generate between 1 and 100 messages
          (userId, messages) => {
            // Clear any existing data for this user
            clearMessages(userId)

            // Save all messages one by one
            for (const message of messages) {
              saveMessage(userId, message)
            }

            // Load the stored messages
            const storedMessages = loadMessages(userId)

            // Property: stored messages should never exceed the limit
            expect(storedMessages.length).toBeLessThanOrEqual(MAX_STORED_MESSAGES)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('when limit is exceeded, oldest messages are removed', () => {
      fc.assert(
        fc.property(
          userIdArb,
          chatMessagesArb(MAX_STORED_MESSAGES + 1, MAX_STORED_MESSAGES + 20), // Generate more than limit
          (userId, messages) => {
            // Clear any existing data for this user
            clearMessages(userId)

            // Save all messages one by one
            for (const message of messages) {
              saveMessage(userId, message)
            }

            // Load the stored messages
            const storedMessages = loadMessages(userId)

            // Property: should have exactly MAX_STORED_MESSAGES
            expect(storedMessages.length).toBe(MAX_STORED_MESSAGES)

            // Property: the stored messages should be the most recent ones
            // The last message saved should be the last message stored
            const lastSavedMessage = messages[messages.length - 1]
            const lastStoredMessage = storedMessages[storedMessages.length - 1]
            expect(lastStoredMessage.id).toBe(lastSavedMessage.id)
            expect(lastStoredMessage.content).toBe(lastSavedMessage.content)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('messages under the limit are all preserved', () => {
      fc.assert(
        fc.property(
          userIdArb,
          chatMessagesArb(1, MAX_STORED_MESSAGES), // Generate at most the limit
          (userId, messages) => {
            // Clear any existing data for this user
            clearMessages(userId)

            // Save all messages one by one
            for (const message of messages) {
              saveMessage(userId, message)
            }

            // Load the stored messages
            const storedMessages = loadMessages(userId)

            // Property: all messages should be preserved when under limit
            expect(storedMessages.length).toBe(messages.length)

            // Property: messages should be in the same order
            for (let i = 0; i < messages.length; i++) {
              expect(storedMessages[i].id).toBe(messages[i].id)
              expect(storedMessages[i].content).toBe(messages[i].content)
              expect(storedMessages[i].role).toBe(messages[i].role)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clearMessages removes all stored messages', () => {
      fc.assert(
        fc.property(
          userIdArb,
          chatMessagesArb(1, 30),
          (userId, messages) => {
            // Save messages
            for (const message of messages) {
              saveMessage(userId, message)
            }

            // Verify messages are stored
            expect(loadMessages(userId).length).toBeGreaterThan(0)

            // Clear messages
            clearMessages(userId)

            // Property: after clearing, no messages should remain
            expect(loadMessages(userId).length).toBe(0)
            expect(getStoredSession(userId)).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('messages are persisted correctly with all fields', () => {
      fc.assert(
        fc.property(
          userIdArb,
          chatMessageArb,
          (userId, message) => {
            // Clear any existing data
            clearMessages(userId)

            // Save the message
            saveMessage(userId, message)

            // Load and verify
            const storedMessages = loadMessages(userId)
            expect(storedMessages.length).toBe(1)

            const stored = storedMessages[0]
            expect(stored.id).toBe(message.id)
            expect(stored.role).toBe(message.role)
            expect(stored.content).toBe(message.content)
            // Timestamp is converted to Date object
            expect(stored.timestamp instanceof Date).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('different users have isolated chat histories', () => {
      fc.assert(
        fc.property(
          userIdArb,
          userIdArb,
          chatMessagesArb(1, 10),
          chatMessagesArb(1, 10),
          (userId1, userId2, messages1, messages2) => {
            // Skip if user IDs are the same
            if (userId1 === userId2) return true

            // Clear any existing data
            clearMessages(userId1)
            clearMessages(userId2)

            // Save messages for user 1
            for (const message of messages1) {
              saveMessage(userId1, message)
            }

            // Save messages for user 2
            for (const message of messages2) {
              saveMessage(userId2, message)
            }

            // Property: each user should have their own messages
            const stored1 = loadMessages(userId1)
            const stored2 = loadMessages(userId2)

            expect(stored1.length).toBe(messages1.length)
            expect(stored2.length).toBe(messages2.length)

            // Verify user 1's messages
            for (let i = 0; i < messages1.length; i++) {
              expect(stored1[i].id).toBe(messages1[i].id)
            }

            // Verify user 2's messages
            for (let i = 0; i < messages2.length; i++) {
              expect(stored2[i].id).toBe(messages2[i].id)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('updateLastReferencedIds persists task and subtask references', () => {
      fc.assert(
        fc.property(
          userIdArb,
          fc.uuid(),
          fc.uuid(),
          (userId, taskId, subtaskId) => {
            // Clear any existing data
            clearMessages(userId)

            // Update the references
            updateLastReferencedIds(userId, taskId, subtaskId)

            // Load the session
            const session = getStoredSession(userId)

            // Property: references should be persisted
            expect(session).not.toBeNull()
            expect(session!.lastReferencedTaskId).toBe(taskId)
            expect(session!.lastReferencedSubtaskId).toBe(subtaskId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('updateLastReferencedIds can clear references with null', () => {
      fc.assert(
        fc.property(
          userIdArb,
          fc.uuid(),
          fc.uuid(),
          (userId, taskId, subtaskId) => {
            // Clear any existing data
            clearMessages(userId)

            // Set references
            updateLastReferencedIds(userId, taskId, subtaskId)

            // Clear references
            updateLastReferencedIds(userId, null, null)

            // Load the session
            const session = getStoredSession(userId)

            // Property: references should be cleared
            expect(session).not.toBeNull()
            expect(session!.lastReferencedTaskId).toBeNull()
            expect(session!.lastReferencedSubtaskId).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
