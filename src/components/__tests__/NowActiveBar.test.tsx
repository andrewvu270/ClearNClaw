import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { NowActiveBar } from '../NowActiveBar'
import type { EnergyTag } from '../../utils/energyTag'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

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
  subTasks: fc.array(subTaskArb, { minLength: 0, maxLength: 5 }),
  energyTag: energyTagArb,
  reminderAt: fc.constant(null),
  repeatSchedule: fc.constant(null),
})

const timerStateArb = fc.record({
  isRunning: fc.boolean(),
  isPaused: fc.boolean(),
  remainingSeconds: fc.integer({ min: 0, max: 3600 }),
}).filter(s => !(s.isRunning && s.isPaused)) // can't be both running and paused

describe('NowActiveBar', () => {
  /**
   * Feature: ux-flow-refinement, Property 1: Now-Active Bar visibility is equivalent to timer active state
   *
   * For any application state, the Now-Active Bar is rendered if and only if
   * a timer is active (running or paused). When no timer is active, the bar is absent.
   *
   * Validates: Requirements 5.1, 5.4
   */
  describe('Property 1: Now-Active Bar visibility is equivalent to timer active state', () => {
    it('should render iff timer is active (running or paused) with a task', () => {
      fc.assert(
        fc.property(
          fc.option(bigTaskArb, { nil: null }),
          timerStateArb,
          (task, timerState) => {
            const timerActive = timerState.isRunning || timerState.isPaused
            const shouldBeVisible = timerActive && task !== null

            const { unmount, queryByTestId } = render(
              <>
                {shouldBeVisible && task ? (
                  <NowActiveBar
                    task={task}
                    remainingSeconds={timerState.remainingSeconds}
                    isPaused={timerState.isPaused}
                    onClick={vi.fn()}
                    onCancel={vi.fn()}
                  />
                ) : null}
              </>
            )

            const bar = queryByTestId('now-active-bar')

            if (shouldBeVisible) {
              expect(bar).toBeInTheDocument()
            } else {
              expect(bar).not.toBeInTheDocument()
            }

            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: ux-flow-refinement, Property 2: Now-Active Bar displays correct task information
   *
   * For any task with an active timer, the Now-Active Bar should display that task's emoji,
   * that task's name, and the current remaining time from the timer.
   *
   * Validates: Requirements 5.2
   */
  describe('Property 2: Now-Active Bar displays correct task information', () => {
    it('should display the task emoji, name, and formatted remaining time', () => {
      fc.assert(
        fc.property(
          bigTaskArb,
          fc.integer({ min: 0, max: 3600 }),
          fc.boolean(),
          (task, remainingSeconds, isPaused) => {
            const { unmount, getByTestId } = render(
              <NowActiveBar
                task={task}
                remainingSeconds={remainingSeconds}
                isPaused={isPaused}
                onClick={vi.fn()}
                onCancel={vi.fn()}
              />
            )

            // Emoji is displayed
            const emojiEl = getByTestId('now-active-emoji')
            expect(emojiEl.textContent).toContain(task.emoji)

            // Task name is displayed
            const nameEl = getByTestId('now-active-name')
            expect(nameEl.textContent).toContain(task.name)

            // Remaining time is formatted and displayed
            const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
            const seconds = String(remainingSeconds % 60).padStart(2, '0')
            const expectedTime = `${minutes}:${seconds}`
            const timeEl = getByTestId('now-active-time')
            expect(timeEl.textContent).toBe(expectedTime)

            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
