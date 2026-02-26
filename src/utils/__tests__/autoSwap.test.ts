import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeAutoSwap } from '../autoSwap'
import type { EnergyTag } from '../energyTag'

const energyTagArb = fc.constantFrom<EnergyTag>('high', 'medium', 'low')

const subTaskArb = fc.record({
  id: fc.uuid(),
  bigTaskId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  sortOrder: fc.nat(),
})

const bigTaskArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.stringMatching(/^[a-zA-Z0-9 ]+$/).filter(s => s.trim().length > 0),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  subTasks: fc.array(subTaskArb, { minLength: 0, maxLength: 3 }),
  energyTag: energyTagArb,
  reminderAt: fc.constant(null),
  repeatSchedule: fc.constant(null),
})

// Timer state: running or paused (but not both, and at least one must be true for "active")
const activeTimerStateArb = fc.oneof(
  fc.constant({ isRunning: true, isPaused: false }),
  fc.constant({ isRunning: false, isPaused: true }),
)

describe('Auto-Swap Timer', () => {
  /**
   * Feature: ux-flow-refinement, Property 3: Auto-swap enforces single active timer
   *
   * For any two distinct tasks, if a timer is running on the first task and the user
   * starts a timer on the second task, then after the swap exactly one timer is active
   * and it is associated with the second task.
   *
   * Validates: Requirements 6.1, 6.2
   */
  describe('Property 3: Auto-swap enforces single active timer', () => {
    it('for any two distinct tasks with an active timer on the first, clicking the second should stop the first and focus the second', () => {
      fc.assert(
        fc.property(
          bigTaskArb,
          bigTaskArb,
          activeTimerStateArb,
          (taskA, taskB, timerState) => {
            // Ensure the two tasks are distinct
            fc.pre(taskA.id !== taskB.id)

            const result = computeAutoSwap(
              taskB,
              timerState.isRunning,
              timerState.isPaused,
              taskA,
            )

            // The existing timer should be stopped
            expect(result.shouldStopExisting).toBe(true)

            // The new active task should be the clicked task (taskB)
            expect(result.newActiveTask.id).toBe(taskB.id)

            // A toast notification should be shown with the new task name
            expect(result.toastMessage).toBe(`Switched focus to ${taskB.name}`)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clicking the same task that already has an active timer should not trigger a swap', () => {
      fc.assert(
        fc.property(
          bigTaskArb,
          activeTimerStateArb,
          (task, timerState) => {
            const result = computeAutoSwap(
              task,
              timerState.isRunning,
              timerState.isPaused,
              task, // same task is active
            )

            // No swap needed — same task
            expect(result.shouldStopExisting).toBe(false)
            expect(result.newActiveTask.id).toBe(task.id)
            expect(result.toastMessage).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clicking a task when no timer is active should not trigger a swap', () => {
      fc.assert(
        fc.property(
          bigTaskArb,
          (task) => {
            const result = computeAutoSwap(
              task,
              false, // not running
              false, // not paused
              null,  // no active task
            )

            expect(result.shouldStopExisting).toBe(false)
            expect(result.newActiveTask.id).toBe(task.id)
            expect(result.toastMessage).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
