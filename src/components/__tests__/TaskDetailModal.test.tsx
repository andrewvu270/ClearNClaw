import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import { TaskDetailModal } from '../TaskDetailModal'
import type { BigTask } from '../../types'
import type { EnergyTag } from '../../utils/energyTag'

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
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  subTasks: fc.array(subTaskArb, { minLength: 0, maxLength: 10 }),
  energyTag: energyTagArb,
  reminderAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
})

describe('TaskDetailModal (Task Settings Sheet)', () => {
  describe('Property 5: Modal state isolation', () => {
    it('should not call any mutation handlers when opened and closed without changes', () => {
      fc.assert(
        fc.property(bigTaskArb, (task) => {
          const originalTask = JSON.parse(JSON.stringify(task)) as BigTask

          const onDelete = vi.fn()
          const onSetReminder = vi.fn()
          const onClose = vi.fn()

          const { unmount } = render(
            <TaskDetailModal
              task={task}
              isOpen={true}
              onClose={onClose}
              onDelete={onDelete}
              onSetReminder={onSetReminder}
            />
          )

          expect(screen.getByText('Task Settings')).toBeInTheDocument()

          unmount()

          expect(onDelete).not.toHaveBeenCalled()

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

  describe('Property 5: Task Settings Sheet contains required settings', () => {
    it('should display reminder toggle and delete button for any task', () => {
      fc.assert(
        fc.property(bigTaskArb, (task) => {
          const { unmount } = render(
            <TaskDetailModal
              task={task}
              isOpen={true}
              onClose={vi.fn()}
              onDelete={vi.fn()}
              onSetReminder={vi.fn()}
            />
          )

          expect(screen.getByTestId('settings-sheet')).toBeInTheDocument()

          const nameEl = screen.getByTestId('settings-task-name')
          expect(nameEl).toBeInTheDocument()
          expect(nameEl.textContent).toBe(task.name)

          const reminderSection = screen.getByTestId('settings-reminder')
          expect(reminderSection).toBeInTheDocument()
          const reminderToggle = screen.getByTestId('settings-reminder-toggle')
          expect(reminderToggle).toBeInTheDocument()

          const deleteBtn = screen.getByTestId('settings-delete-btn')
          expect(deleteBtn).toBeInTheDocument()

          const closeBtn = screen.getByTestId('settings-close-btn')
          expect(closeBtn).toBeInTheDocument()

          unmount()
        }),
        { numRuns: 100 }
      )
    })
  })
})
