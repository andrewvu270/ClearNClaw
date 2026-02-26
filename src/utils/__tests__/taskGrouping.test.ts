import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { groupTasks } from '../taskGrouping'
import type { RepeatOption } from '../../types'
import type { EnergyTag } from '../energyTag'

/**
 * Feature: task-ui-refactor, Property 1: Task grouping correctness
 * 
 * For any set of Big Tasks, the grouping function should place each task in exactly one group:
 * Planned if 0 subtasks are complete, Active if some but not all subtasks are complete,
 * and Done if all subtasks are complete (or task.completed is true).
 * 
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6
 */

// Arbitrary generators for property-based testing
const energyTagArb = fc.constantFrom<EnergyTag>('high', 'medium', 'low')

const subTaskArb = fc.record({
  id: fc.uuid(),
  bigTaskId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  sortOrder: fc.nat(),
})

const bigTaskArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  subTasks: fc.array(subTaskArb, { minLength: 0, maxLength: 10 }),
  energyTag: energyTagArb,
  reminderAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  repeatSchedule: fc.option(fc.constantFrom<RepeatOption>('daily', 'weekly', 'custom'), { nil: null }),
})

describe('taskGrouping', () => {
  describe('Property 1: Task grouping correctness', () => {
    it('should place each task in exactly one group', () => {
      fc.assert(
        fc.property(fc.array(bigTaskArb, { minLength: 0, maxLength: 50 }), (tasks) => {
          const { planned, active, done } = groupTasks(tasks)

          // Property 1a: Every task appears in exactly one group
          const allGroupedTasks = [...planned, ...active, ...done]
          expect(allGroupedTasks.length).toBe(tasks.length)

          // Property 1b: No task appears in multiple groups
          const plannedIds = new Set(planned.map(t => t.id))
          const activeIds = new Set(active.map(t => t.id))
          const doneIds = new Set(done.map(t => t.id))

          expect(plannedIds.size).toBe(planned.length)
          expect(activeIds.size).toBe(active.length)
          expect(doneIds.size).toBe(done.length)

          // No overlap between groups
          for (const id of plannedIds) {
            expect(activeIds.has(id)).toBe(false)
            expect(doneIds.has(id)).toBe(false)
          }
          for (const id of activeIds) {
            expect(doneIds.has(id)).toBe(false)
          }

          // Property 1c: Tasks are grouped correctly by completion status
          for (const task of planned) {
            const completedCount = task.subTasks.filter(st => st.completed).length
            expect(completedCount).toBe(0)
            expect(task.completed).toBe(false)
          }

          for (const task of active) {
            const completedCount = task.subTasks.filter(st => st.completed).length
            const totalCount = task.subTasks.length
            expect(completedCount).toBeGreaterThan(0)
            expect(completedCount).toBeLessThan(totalCount)
            expect(task.completed).toBe(false)
          }

          for (const task of done) {
            if (task.completed) {
              // Task marked as completed goes to done regardless of subtasks
              expect(task.completed).toBe(true)
            } else {
              // All subtasks must be complete
              const completedCount = task.subTasks.filter(st => st.completed).length
              const totalCount = task.subTasks.length
              expect(completedCount).toBe(totalCount)
            }
          }
        }),
        { numRuns: 100 }
      )
    })
  })
})
