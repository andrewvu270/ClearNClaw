import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { selectNotificationTask } from '../pushService'

// Generator for a sub-task with a completed flag
const subTaskArb = fc.record({
  completed: fc.boolean(),
})

// Generator for a task with sub-tasks (at least 1 sub-task)
const taskArb = fc.record({
  completed: fc.boolean(),
  subTasks: fc.array(subTaskArb, { minLength: 1, maxLength: 10 }),
})

/**
 * **Feature: post-launch-improvements, Property 8: Notification task selection**
 * **Validates: Requirements 5.2**
 *
 * For any set of active Big Tasks with varying numbers of incomplete Sub-Tasks,
 * the notification task selector should return the Big Task with the fewest
 * remaining incomplete Sub-Tasks.
 */
describe('selectNotificationTask', () => {
  it('Property 8: returns the active task with the fewest remaining incomplete sub-tasks', () => {
    fc.assert(
      fc.property(
        fc.array(taskArb, { minLength: 1, maxLength: 20 }),
        (tasks) => {
          const result = selectNotificationTask(tasks)

          // Determine active tasks (not completed, has at least one incomplete sub-task)
          const active = tasks.filter(
            (t) => !t.completed && t.subTasks.some((st) => !st.completed)
          )

          if (active.length === 0) {
            // No active tasks → should return null
            expect(result).toBeNull()
          } else {
            // Should return a task
            expect(result).not.toBeNull()

            // The returned task must be active
            expect(result!.completed).toBe(false)
            expect(result!.subTasks.some((st) => !st.completed)).toBe(true)

            // The returned task must have the fewest remaining incomplete sub-tasks
            const resultRemaining = result!.subTasks.filter((st) => !st.completed).length
            const minRemaining = Math.min(
              ...active.map((t) => t.subTasks.filter((st) => !st.completed).length)
            )
            expect(resultRemaining).toBe(minRemaining)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
