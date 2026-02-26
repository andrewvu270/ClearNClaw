import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import * as fc from 'fast-check'
import { CompactTaskCard } from '../CompactTaskCard'
import type { EnergyTag } from '../../utils/energyTag'

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
  name: fc.stringMatching(/^[a-zA-Z0-9 ]+$/).filter(s => s.trim().length > 0),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  subTasks: fc.array(subTaskArb, { minLength: 0, maxLength: 10 }),
  energyTag: energyTagArb,
  reminderAt: fc.constant(null),
  repeatSchedule: fc.constant(null),
})

describe('CompactTaskCard', () => {
  /**
   * Feature: ux-flow-refinement, Property 4: Compact Task Card contains correct elements and no checkbox
   *
   * For any task rendered as a Compact Task Card, the card should display the task emoji,
   * task name, and a settings (info) icon, and should not contain a checkbox.
   *
   * Validates: Requirements 2.1, 2.2
   */
  describe('Property 4: Compact Task Card contains correct elements and no checkbox', () => {
    it('should display emoji, name, settings icon, and no checkbox for any task', () => {
      fc.assert(
        fc.property(bigTaskArb, (task) => {
          const { unmount, container } = render(
            <CompactTaskCard
              task={task}
              onCardClick={vi.fn()}
              onSettingsClick={vi.fn()}
            />
          )

          const card = within(container)
          const text = container.textContent || ''

          // Emoji is present in the rendered output
          expect(text).toContain(task.emoji)

          // Task name is present in the rendered output
          expect(text).toContain(task.name)

          // Settings icon button is present
          expect(card.getByLabelText('Task settings')).toBeInTheDocument()

          // No checkbox input is present
          const checkboxes = container.querySelectorAll('input[type="checkbox"]')
          expect(checkboxes.length).toBe(0)

          // No checkbox-related aria labels
          expect(card.queryByLabelText('Task completed')).not.toBeInTheDocument()
          expect(card.queryByLabelText('Complete task')).not.toBeInTheDocument()

          unmount()
        }),
        { numRuns: 100 }
      )
    })
  })
})
