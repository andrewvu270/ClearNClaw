import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { FocusView } from '../../components/FocusView'
import type { EnergyTag } from '../../utils/energyTag'

// Mock Aurora (uses WebGL which isn't available in jsdom)
vi.mock('../../components/Aurora', () => ({
  Aurora: () => <div data-testid="aurora-mock" />,
}))

// Mock StimModeContext used by Aurora
vi.mock('../../contexts/StimModeContext', () => ({
  useStimMode: () => ({ isLowStim: false, toggle: vi.fn(), setLowStim: vi.fn() }),
  StimModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock FocusTimerContext — idle timer (no timer running)
vi.mock('../../contexts/FocusTimerContext', () => ({
  useFocusTimer: () => ({
    remainingSeconds: 0,
    totalSeconds: 0,
    isRunning: false,
    isPaused: false,
    isPomodoro: false,
    pomodoroCount: 0,
    isBreak: false,
    activeTask: null,
    setActiveTask: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }),
}))

// Arbitraries
const energyTagArb = fc.constantFrom<EnergyTag>('high', 'medium', 'low')

const subTaskArb = fc.record({
  id: fc.uuid(),
  bigTaskId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.boolean(),
  sortOrder: fc.nat(),
})

const nonCompletedTaskArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.stringMatching(/^[a-zA-Z0-9 ]+$/).filter(s => s.trim().length > 0),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.constant(false),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.constant(null),
  subTasks: fc.array(subTaskArb, { minLength: 1, maxLength: 5 }),
  energyTag: energyTagArb,
  reminderAt: fc.constant(null),
  repeatSchedule: fc.constant(null),
})

const completedTaskArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.stringMatching(/^[a-zA-Z0-9 ]+$/).filter(s => s.trim().length > 0),
  emoji: fc.constantFrom('📝', '✅', '🎯', '💡', '🔥'),
  completed: fc.constant(true),
  createdAt: fc.date().map(d => d.toISOString()),
  completedAt: fc.date().map(d => d.toISOString()),
  subTasks: fc.array(subTaskArb, { minLength: 1, maxLength: 5 }),
  energyTag: energyTagArb,
  reminderAt: fc.constant(null),
  repeatSchedule: fc.constant(null),
})

describe('FocusView', () => {
  /**
   * Feature: ux-flow-refinement, Property 6: Focus View for non-completed task has editable fields and all elements
   *
   * For any non-completed task opened in Focus View, the view should contain an editable task name,
   * editable emoji, progress ring, sub-task list with checkboxes, and timer controls.
   *
   * Validates: Requirements 4.1, 4.3, 7.1
   */
  describe('Property 6: Focus View for non-completed task has editable fields and all elements', () => {
    it('should display editable name, editable emoji, progress ring, subtasks with checkboxes, and timer controls for any non-completed task', () => {
      fc.assert(
        fc.property(nonCompletedTaskArb, (task) => {
          const { unmount, container } = render(
            <FocusView
              task={task}
              readOnly={false}
              onClose={vi.fn()}
              onEditName={vi.fn()}
              onEditEmoji={vi.fn()}
              onToggleSubTask={vi.fn()}
              onEditSubTaskName={vi.fn()}
              onEditSubTaskEmoji={vi.fn()}
              onDeleteSubTask={vi.fn()}
              onAddSubTask={vi.fn()}
            />
          )

          // Editable task name (rendered as a clickable button, not a plain <p>)
          const editableNameBtn = container.querySelector('[data-testid="focus-task-name-editable"]')
          expect(editableNameBtn).not.toBeNull()
          expect(editableNameBtn!.textContent).toBe(task.name)

          // Read-only name should NOT be present
          const readOnlyName = container.querySelector('[data-testid="focus-task-name-readonly"]')
          expect(readOnlyName).toBeNull()

          // Editable emoji (rendered as a clickable button)
          const editableEmoji = container.querySelector('[data-testid="focus-emoji-editable"]')
          expect(editableEmoji).not.toBeNull()

          // Progress ring (CircularProgressEmoji renders an SVG with a circle)
          const svgElements = container.querySelectorAll('svg')
          expect(svgElements.length).toBeGreaterThan(0)

          // Task emoji is displayed
          const emojiSpan = container.querySelector('[role="img"][aria-label="task emoji"]')
          expect(emojiSpan).not.toBeNull()
          expect(emojiSpan!.textContent).toBe(task.emoji)

          // Timer start button is present (since no timer is running)
          const startTimerBtn = container.querySelector('[data-testid="focus-start-timer-btn"]')
          expect(startTimerBtn).not.toBeNull()

          // Sub-tasks are rendered with checkboxes
          const subtaskCheckboxes = container.querySelectorAll('[aria-label="Mark complete"], [aria-label="Mark incomplete"]')
          expect(subtaskCheckboxes.length).toBe(task.subTasks.length)

          // Back button is present
          const backBtn = container.querySelector('[aria-label="Back"]')
          expect(backBtn).not.toBeNull()

          // Add sub-task input is present (only for non-readOnly)
          const addSubtask = container.querySelector('[data-testid="focus-add-subtask"]')
          expect(addSubtask).not.toBeNull()

          // Progress text shows correct count
          const progressText = container.querySelector('[data-testid="focus-progress-text"]')
          expect(progressText).not.toBeNull()
          const doneCount = task.subTasks.filter(st => st.completed).length
          expect(progressText!.textContent).toBe(`${doneCount}/${task.subTasks.length} done`)

          unmount()
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: ux-flow-refinement, Property 7: Focus View for completed task is fully read-only with timer disabled
   *
   * For any completed task opened in Focus View, the task name and emoji should be displayed
   * as non-editable text, timer controls should be absent or disabled, and subtask checkboxes
   * should be non-interactive.
   *
   * Validates: Requirements 4.2, 4.4
   */
  describe('Property 7: Focus View for completed task is fully read-only with timer disabled', () => {
    it('should display read-only name, non-editable emoji, no timer controls, and disabled subtask checkboxes for any completed task', () => {
      fc.assert(
        fc.property(completedTaskArb, (task) => {
          const { unmount, container } = render(
            <FocusView
              task={task}
              readOnly={true}
              onClose={vi.fn()}
              onEditName={vi.fn()}
              onEditEmoji={vi.fn()}
              onToggleSubTask={vi.fn()}
              onEditSubTaskName={vi.fn()}
              onEditSubTaskEmoji={vi.fn()}
              onDeleteSubTask={vi.fn()}
              onAddSubTask={vi.fn()}
            />
          )

          // Read-only task name is present (plain <p>, not a clickable button)
          const readOnlyName = container.querySelector('[data-testid="focus-task-name-readonly"]')
          expect(readOnlyName).not.toBeNull()
          expect(readOnlyName!.textContent).toBe(task.name)

          // Editable name button should NOT be present
          const editableNameBtn = container.querySelector('[data-testid="focus-task-name-editable"]')
          expect(editableNameBtn).toBeNull()

          // Editable emoji button should NOT be present
          const editableEmoji = container.querySelector('[data-testid="focus-emoji-editable"]')
          expect(editableEmoji).toBeNull()

          // Timer start button should NOT be present
          const startTimerBtn = container.querySelector('[data-testid="focus-start-timer-btn"]')
          expect(startTimerBtn).toBeNull()

          // Timer controls (pause/resume/reset) should NOT be present
          const timerControls = container.querySelector('[data-testid="focus-timer-controls"]')
          expect(timerControls).toBeNull()

          // Sub-task checkboxes should be disabled
          const subtaskCheckboxes = container.querySelectorAll('[aria-label="Mark complete"], [aria-label="Mark incomplete"]')
          expect(subtaskCheckboxes.length).toBe(task.subTasks.length)
          subtaskCheckboxes.forEach(btn => {
            expect((btn as HTMLButtonElement).disabled).toBe(true)
          })

          // Add sub-task input should NOT be present
          const addSubtask = container.querySelector('[data-testid="focus-add-subtask"]')
          expect(addSubtask).toBeNull()

          // Delete buttons on subtasks should NOT be present
          const deleteButtons = container.querySelectorAll('[aria-label="Delete sub-task"]')
          expect(deleteButtons.length).toBe(0)

          unmount()
        }),
        { numRuns: 100 }
      )
    })
  })
})
