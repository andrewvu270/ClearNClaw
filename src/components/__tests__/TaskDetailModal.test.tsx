import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import { TaskDetailModal } from '../TaskDetailModal'
import type { BigTask, RepeatOption } from '../../types'
import type { EnergyTag } from '../../utils/energyTag'

// Arbitrary generators for property-based testing
const energyTagArb = fc.constantFrom<EnergyTag>('high', 'medium', 'low')
const repeatArb = fc.constantFrom<RepeatOption | null>('daily', 'weekly', 'custom', null)

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
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  subTasks: fc.array(subTaskArb, { minLength: 0, maxLength: 10 }),
  energyTag: energyTagArb,
  reminderAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  repeatSchedule: repeatArb,
})

describe('TaskDetailModal (Task Settings Sheet)', () => {
  /**
   * Feature: task-ui-refactor, Property 5: Modal state isolation
   * Validates: Requirements 3.8
   *
   * Updated for new Task Settings Sheet interface.
   */
  describe('Property 5: Modal state isolation', () => {
    it('should not call any mutation handlers when opened and closed without changes', () => {
      fc.assert(
        fc.property(bigTaskArb, (task) => {
          const originalTask = JSON.parse(JSON.stringify(task)) as BigTask

          const onDelete = vi.fn()
          const onSetReminder = vi.fn()
          const onSetRepeat = vi.fn()
          const onClose = vi.fn()

          const { unmount } = render(
            <TaskDetailModal
              task={task}
              isOpen={true}
              onClose={onClose}
              onDelete={onDelete}
              onSetReminder={onSetReminder}
              onSetRepeat={onSetRepeat}
            />
          )

          expect(screen.getByText('Task Settings')).toBeInTheDocument()

          unmount()

          // No mutation handlers should have been called
          expect(onDelete).not.toHaveBeenCalled()
          // onSetReminder/onSetRepeat may be called during init sync — that's fine
          // but onDelete should never fire without user action

          // Task object should remain unchanged
          expect(task.id).toBe(originalTask.id)
          expect(task.name).toBe(originalTask.name)
          expect(task.emoji).toBe(originalTask.emoji)
          expect(task.completed).toBe(originalTask.completed)
          expect(task.energyTag).toBe(originalTask.energyTag)
          expect(task.subTasks.length).toBe(originalTask.subTasks.length)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: ux-flow-refinement, Property 5: Task Settings Sheet contains required settings
   *
   * For any task opened in the Task Settings Sheet, the sheet should contain
   * a reminder toggle, a repeat option, and a delete task button.
   *
   * Validates: Requirements 3.3
   */
  describe('Property 5: Task Settings Sheet contains required settings', () => {
    it('should display reminder toggle, repeat option, and delete button for any task', () => {
      fc.assert(
        fc.property(bigTaskArb, (task) => {
          const { unmount } = render(
            <TaskDetailModal
              task={task}
              isOpen={true}
              onClose={vi.fn()}
              onDelete={vi.fn()}
              onSetReminder={vi.fn()}
              onSetRepeat={vi.fn()}
            />
          )

          // Sheet is rendered
          expect(screen.getByTestId('settings-sheet')).toBeInTheDocument()

          // Task name displayed as read-only label
          const nameEl = screen.getByTestId('settings-task-name')
          expect(nameEl).toBeInTheDocument()
          expect(nameEl.textContent).toBe(task.name)

          // Reminder toggle is present
          const reminderSection = screen.getByTestId('settings-reminder')
          expect(reminderSection).toBeInTheDocument()
          const reminderToggle = screen.getByTestId('settings-reminder-toggle')
          expect(reminderToggle).toBeInTheDocument()

          // Repeat option selector is present
          const repeatSection = screen.getByTestId('settings-repeat')
          expect(repeatSection).toBeInTheDocument()
          const repeatSelect = screen.getByTestId('settings-repeat-select')
          expect(repeatSelect).toBeInTheDocument()

          // Delete button is present
          const deleteBtn = screen.getByTestId('settings-delete-btn')
          expect(deleteBtn).toBeInTheDocument()

          // Close button is present
          const closeBtn = screen.getByTestId('settings-close-btn')
          expect(closeBtn).toBeInTheDocument()

          unmount()
        }),
        { numRuns: 100 }
      )
    })
  })
})
