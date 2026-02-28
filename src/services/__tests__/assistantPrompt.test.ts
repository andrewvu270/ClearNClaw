import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { BigTask } from '../../types'
import {
  KLAW_VOICE_PROMPT,
  KLAW_VOICE_SYSTEM_PROMPT,
} from '../assistantPrompt'
import { formatTasksForVoice, injectTaskContext } from '../assistantContext'

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
const bigTaskArb: fc.Arbitrary<BigTask> = fc.record({
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

describe('AssistantPrompt', () => {
  /**
   * Feature: klaw-voice-function-calling, Property 5: System prompt contains no ACTION tag syntax
   *
   * For any version of Klaw's voice system prompt, the prompt text SHALL NOT contain
   * the pattern `[ACTION:` or instructions about ACTION tag formatting.
   *
   * Validates: Requirements 3.1
   */
  describe('Property 5: System prompt contains no ACTION tag syntax', () => {
    const ACTION_TAG_PATTERNS = [
      /\[ACTION:/i,
      /\[ACTION\s*:/i,
      /ACTION\s*tag/i,
      /\[ACTION\s*\]/i,
    ]

    it('KLAW_VOICE_PROMPT does not contain ACTION tag patterns', () => {
      for (const pattern of ACTION_TAG_PATTERNS) {
        expect(KLAW_VOICE_PROMPT).not.toMatch(pattern)
      }
    })

    it('KLAW_VOICE_PROMPT does not contain JSON syntax examples for actions', () => {
      // Should not have JSON-like action examples
      expect(KLAW_VOICE_PROMPT).not.toMatch(/\{"description":/i)
      expect(KLAW_VOICE_PROMPT).not.toMatch(/\{"taskName":/i)
      expect(KLAW_VOICE_PROMPT).not.toMatch(/\{"subtaskName":/i)
      expect(KLAW_VOICE_PROMPT).not.toMatch(/\{"duration":/i)
      expect(KLAW_VOICE_PROMPT).not.toMatch(/confirmed.*true/i)
    })

    it('KLAW_VOICE_PROMPT contains {taskContext} placeholder', () => {
      expect(KLAW_VOICE_PROMPT).toContain('{taskContext}')
    })

    it('injected prompt with any task context still has no ACTION tags', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 10 }),
          (tasks) => {
            const injectedPrompt = injectTaskContext(KLAW_VOICE_PROMPT, tasks)

            // Should not contain ACTION tag patterns after injection
            for (const pattern of ACTION_TAG_PATTERNS) {
              expect(injectedPrompt).not.toMatch(pattern)
            }

            // Should not contain the placeholder anymore
            expect(injectedPrompt).not.toContain('{taskContext}')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('legacy KLAW_VOICE_SYSTEM_PROMPT still contains ACTION tags (for backwards compatibility check)', () => {
      // The deprecated prompt should still have ACTION tags
      expect(KLAW_VOICE_SYSTEM_PROMPT).toMatch(/\[ACTION:/)
    })
  })

  describe('formatTasksForVoice', () => {
    it('returns "No active tasks" message for empty array', () => {
      const result = formatTasksForVoice([])
      expect(result).toBe('No active tasks right now.')
    })

    it('formats tasks without emojis (voice-friendly)', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 1, maxLength: 10 }),
          (tasks) => {
            const result = formatTasksForVoice(tasks)

            // Should not contain common emoji patterns
            // (checking for emoji unicode ranges is complex, so we check for specific ones)
            expect(result).not.toMatch(/[🎯📝✨🚀💡▪️✅]/u)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('limits output to 5 tasks with "and X more" suffix', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 6, maxLength: 15 }),
          (tasks) => {
            const result = formatTasksForVoice(tasks)

            // Should mention "and X more"
            expect(result).toMatch(/\.\.\.and \d+ more\./)

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('includes task names in quotes', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb.filter(t => t.name.length > 0), { minLength: 1, maxLength: 5 }),
          (tasks) => {
            const result = formatTasksForVoice(tasks)

            // Each task name should be in quotes
            for (const task of tasks.slice(0, 5)) {
              if (task.name.length > 0) {
                expect(result).toContain(`"${task.name}"`)
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('includes subtask progress when subtasks exist', () => {
      const taskWithSubtasks: BigTask = {
        id: 'test-id',
        userId: 'user-id',
        name: 'Test Task',
        emoji: '🎯',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st1', bigTaskId: 'test-id', name: 'Subtask 1', emoji: '▪️', completed: true, sortOrder: 0 },
          { id: 'st2', bigTaskId: 'test-id', name: 'Subtask 2', emoji: '▪️', completed: false, sortOrder: 1 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }

      const result = formatTasksForVoice([taskWithSubtasks])

      expect(result).toContain('1 of 2 subtasks done')
      expect(result).toContain('next: "Subtask 2"')
    })
  })

  describe('injectTaskContext', () => {
    it('replaces {taskContext} placeholder with formatted tasks', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 5 }),
          (tasks) => {
            const result = injectTaskContext(KLAW_VOICE_PROMPT, tasks)

            // Placeholder should be replaced
            expect(result).not.toContain('{taskContext}')

            // Should contain the formatted task context
            const expectedContext = formatTasksForVoice(tasks)
            expect(result).toContain(expectedContext)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
