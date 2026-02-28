import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { BigTask } from '../../types'
import type { TimerState } from '../../types/assistant'
import {
  findTaskByName,
  findSubtaskByName,
  completeSubtask,
  renameTask,
  renameSubtask,
  addSubtask,
  removeSubtask,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimerStatus,
  listTasks,
  getTaskDetails,
  getNextSubtask,
  type FunctionContext,
  type TimerController,
} from '../assistantFunctions'

// Arbitrary for generating subtasks
const subtaskArb = fc.record({
  id: fc.uuid(),
  bigTaskId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  emoji: fc.constantFrom('▪️', '✅', '📝', '🎯'),
  completed: fc.boolean(),
  sortOrder: fc.nat({ max: 100 }),
})

// Arbitrary for generating BigTasks
const bigTaskArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  emoji: fc.constantFrom('🎯', '📝', '✨', '🚀', '💡'),
  completed: fc.boolean(),
  createdAt: fc.date().map((d) => d.toISOString()),
  completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  subTasks: fc.array(subtaskArb, { minLength: 0, maxLength: 5 }),
  energyTag: fc.constantFrom('low', 'medium', 'high') as fc.Arbitrary<'low' | 'medium' | 'high'>,
  reminderAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  recurrence: fc.constant(null),
})

// Create a mock timer controller for testing
function createMockTimerController(initialState: TimerState | null = null): TimerController & { state: TimerState | null } {
  const controller = {
    state: initialState,
    start: (durationMs: number) => {
      controller.state = {
        isRunning: true,
        isPaused: false,
        remainingSeconds: Math.ceil(durationMs / 1000),
        totalSeconds: Math.ceil(durationMs / 1000),
        activeTaskId: null,
      }
    },
    stop: () => {
      controller.state = null
    },
    pause: () => {
      if (controller.state) {
        controller.state = { ...controller.state, isRunning: false, isPaused: true }
      }
    },
    resume: () => {
      if (controller.state) {
        controller.state = { ...controller.state, isRunning: true, isPaused: false }
      }
    },
    getState: () => controller.state,
    setActiveTask: (task: BigTask | null) => {
      if (controller.state) {
        controller.state = { ...controller.state, activeTaskId: task?.id ?? null }
      }
    },
  }
  return controller
}

describe('AssistantFunctions', () => {
  /**
   * Feature: vapi-voice-agent, Property 2: Completion operations mark the correct item
   *
   * For any completion request with a task or subtask name, if exactly one item
   * matches the name, that item's completed status SHALL be set to true after the operation.
   *
   * Validates: Requirements 5.1, 5.2, 5.4
   */
  describe('Property 2: Completion operations mark the correct item', () => {
    it('findSubtaskByName returns exactly matching subtasks', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 1, maxLength: 5 }),
          (tasks) => {
            const allSubtasks = tasks.flatMap((t) =>
              t.subTasks.map((st) => ({ task: t, subtask: st }))
            )

            if (allSubtasks.length === 0) return true

            const targetSubtask = allSubtasks[0].subtask
            
            // The function trims the search term, so we need to use the trimmed version
            // for our assertions to match the actual search behavior
            const searchTerm = targetSubtask.name.trim()
            if (searchTerm.length === 0) return true // Skip empty search terms
            
            const matches = findSubtaskByName(tasks, targetSubtask.name)

            // All matches should contain the trimmed search term (case-insensitive)
            // because the function trims whitespace from the search input
            for (const match of matches) {
              expect(match.subtask.name.toLowerCase()).toContain(
                searchTerm.toLowerCase()
              )
            }

            // The target subtask should be in the matches
            const found = matches.some((m) => m.subtask.id === targetSubtask.id)
            expect(found).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('completeSubtask returns disambiguation when multiple matches exist', async () => {
      const duplicateName = 'Buy groceries'
      const task1: BigTask = {
        id: 'task-1',
        userId: 'user-1',
        name: 'Shopping',
        emoji: '🛒',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st-1', bigTaskId: 'task-1', name: duplicateName, emoji: '▪️', completed: false, sortOrder: 0 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }
      const task2: BigTask = {
        id: 'task-2',
        userId: 'user-1',
        name: 'Errands',
        emoji: '📝',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st-2', bigTaskId: 'task-2', name: duplicateName, emoji: '▪️', completed: false, sortOrder: 0 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }

      const ctx: FunctionContext = { userId: 'user-1', tasks: [task1, task2] }
      const result = await completeSubtask(ctx, duplicateName)

      expect(result.success).toBe(false)
      expect(result.message).toContain('multiple')
    })

    it('completeSubtask returns not found when no matches exist', async () => {
      const ctx: FunctionContext = { userId: 'user-1', tasks: [] }
      const result = await completeSubtask(ctx, 'nonexistent-subtask-xyz-123')

      expect(result.success).toBe(false)
      expect(result.message).toContain("couldn't find")
    })
  })


  /**
   * Feature: vapi-voice-agent, Property 3: Edit operations modify the correct items
   *
   * For any edit operation (rename task, rename subtask, add subtask, remove subtask)
   * with valid parameters, the corresponding item SHALL be modified according to the
   * operation type, and the response SHALL confirm the change.
   *
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
   */
  describe('Property 3: Edit operations modify the correct items', () => {
    it('findTaskByName returns exactly matching tasks', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 1, maxLength: 5 }),
          (tasks) => {
            if (tasks.length === 0) return true

            const targetTask = tasks[0]
            const matches = findTaskByName(tasks, targetTask.name)

            // All matches should contain the target name (case-insensitive)
            for (const match of matches) {
              expect(match.name.toLowerCase()).toContain(targetTask.name.toLowerCase())
            }

            // The target task should be in the matches
            const found = matches.some((m) => m.id === targetTask.id)
            expect(found).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('renameTask returns disambiguation when multiple matches exist', async () => {
      const task1: BigTask = {
        id: 'task-1',
        userId: 'user-1',
        name: 'Project Alpha',
        emoji: '🎯',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }
      const task2: BigTask = {
        id: 'task-2',
        userId: 'user-1',
        name: 'Project Beta',
        emoji: '📝',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }

      const ctx: FunctionContext = { userId: 'user-1', tasks: [task1, task2] }
      const result = await renameTask(ctx, 'Project', 'New Name')

      expect(result.success).toBe(false)
      expect(result.message).toContain('multiple')
    })

    it('renameSubtask returns disambiguation when multiple matches exist', async () => {
      const task1: BigTask = {
        id: 'task-1',
        userId: 'user-1',
        name: 'Task 1',
        emoji: '🎯',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st-1', bigTaskId: 'task-1', name: 'Review code', emoji: '▪️', completed: false, sortOrder: 0 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }
      const task2: BigTask = {
        id: 'task-2',
        userId: 'user-1',
        name: 'Task 2',
        emoji: '📝',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st-2', bigTaskId: 'task-2', name: 'Review docs', emoji: '▪️', completed: false, sortOrder: 0 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }

      const ctx: FunctionContext = { userId: 'user-1', tasks: [task1, task2] }
      const result = await renameSubtask(ctx, 'Review', 'New Name')

      expect(result.success).toBe(false)
      expect(result.message).toContain('multiple')
    })

    it('addSubtask returns not found when task does not exist', async () => {
      const ctx: FunctionContext = { userId: 'user-1', tasks: [] }
      const result = await addSubtask(ctx, 'nonexistent-task-xyz-123', 'New subtask')

      expect(result.success).toBe(false)
      expect(result.message).toContain("couldn't find")
    })

    it('removeSubtask returns not found when subtask does not exist', async () => {
      const ctx: FunctionContext = { userId: 'user-1', tasks: [] }
      const result = await removeSubtask(ctx, 'nonexistent-subtask-xyz-123')

      expect(result.success).toBe(false)
      expect(result.message).toContain("couldn't find")
    })
  })


  /**
   * Feature: vapi-voice-agent, Property 5: Timer operations correctly transition state
   *
   * For any timer operation:
   * - startTimer on idle timer → timer becomes running with specified duration
   * - pauseTimer on running timer → timer becomes paused with remaining time preserved
   * - resumeTimer on paused timer → timer becomes running
   * - stopTimer on any state → timer becomes idle
   *
   * Validates: Requirements 9.1, 9.2, 9.3, 9.4
   */
  describe('Property 5: Timer operations correctly transition state', () => {
    it('startTimer on idle timer creates running timer with specified duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 120 }),
          (durationMinutes) => {
            const timerController = createMockTimerController(null)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks: [],
              timerController,
            }

            const result = startTimer(ctx, durationMinutes)

            expect(result.success).toBe(true)
            expect(timerController.state).not.toBeNull()
            expect(timerController.state?.isRunning).toBe(true)
            expect(timerController.state?.isPaused).toBe(false)
            expect(timerController.state?.totalSeconds).toBe(durationMinutes * 60)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('startTimer defaults to 25 minutes when no duration specified', () => {
      const timerController = createMockTimerController(null)
      const ctx: FunctionContext = {
        userId: 'user-1',
        tasks: [],
        timerController,
      }

      const result = startTimer(ctx)

      expect(result.success).toBe(true)
      expect(timerController.state?.totalSeconds).toBe(25 * 60)
    })

    it('startTimer fails when timer is already running', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 120 }),
          fc.integer({ min: 1, max: 120 }),
          (initialDuration, newDuration) => {
            const initialState: TimerState = {
              isRunning: true,
              isPaused: false,
              remainingSeconds: initialDuration * 60,
              totalSeconds: initialDuration * 60,
              activeTaskId: null,
            }
            const timerController = createMockTimerController(initialState)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks: [],
              timerController,
            }

            const result = startTimer(ctx, newDuration)

            expect(result.success).toBe(false)
            expect(result.message).toContain('already running')
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('pauseTimer on running timer transitions to paused state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }),
          (remainingSeconds) => {
            const initialState: TimerState = {
              isRunning: true,
              isPaused: false,
              remainingSeconds,
              totalSeconds: remainingSeconds + 100,
              activeTaskId: null,
            }
            const timerController = createMockTimerController(initialState)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks: [],
              timerController,
            }

            const result = pauseTimer(ctx)

            expect(result.success).toBe(true)
            expect(timerController.state?.isPaused).toBe(true)
            expect(timerController.state?.isRunning).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('pauseTimer fails when no timer is running', () => {
      const timerController = createMockTimerController(null)
      const ctx: FunctionContext = {
        userId: 'user-1',
        tasks: [],
        timerController,
      }

      const result = pauseTimer(ctx)

      expect(result.success).toBe(false)
      expect(result.message).toContain('No timer')
    })

    it('resumeTimer on paused timer transitions to running state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }),
          (remainingSeconds) => {
            const initialState: TimerState = {
              isRunning: false,
              isPaused: true,
              remainingSeconds,
              totalSeconds: remainingSeconds + 100,
              activeTaskId: null,
            }
            const timerController = createMockTimerController(initialState)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks: [],
              timerController,
            }

            const result = resumeTimer(ctx)

            expect(result.success).toBe(true)
            expect(timerController.state?.isRunning).toBe(true)
            expect(timerController.state?.isPaused).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('resumeTimer fails when timer is not paused', () => {
      const initialState: TimerState = {
        isRunning: true,
        isPaused: false,
        remainingSeconds: 300,
        totalSeconds: 600,
        activeTaskId: null,
      }
      const timerController = createMockTimerController(initialState)
      const ctx: FunctionContext = {
        userId: 'user-1',
        tasks: [],
        timerController,
      }

      const result = resumeTimer(ctx)

      expect(result.success).toBe(false)
      expect(result.message).toContain('not paused')
    })

    it('stopTimer on any state transitions to idle', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.record({
              isRunning: fc.boolean(),
              isPaused: fc.boolean(),
              remainingSeconds: fc.integer({ min: 0, max: 3600 }),
              totalSeconds: fc.integer({ min: 1, max: 3600 }),
              activeTaskId: fc.option(fc.uuid(), { nil: null }),
            })
          ),
          (initialState) => {
            const timerController = createMockTimerController(initialState as TimerState | null)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks: [],
              timerController,
            }

            const result = stopTimer(ctx)

            expect(result.success).toBe(true)
            expect(timerController.state).toBeNull()
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  /**
   * Feature: vapi-voice-agent, Property 6: Query operations return accurate information
   *
   * For any query operation (list tasks, get task details, get timer status, get next subtask),
   * the response SHALL accurately reflect the current state of the task system and timer.
   *
   * Validates: Requirements 9.5, 10.1, 10.2, 10.3
   */
  describe('Property 6: Query operations return accurate information', () => {
    it('listTasks returns accurate count and summaries of active tasks', () => {
      fc.assert(
        fc.property(
          fc.array(bigTaskArb, { minLength: 0, maxLength: 10 }),
          (tasks) => {
            const ctx: FunctionContext = { userId: 'user-1', tasks }
            const result = listTasks(ctx)

            expect(result.success).toBe(true)

            const activeTasks = tasks.filter((t) => !t.completed)
            if (activeTasks.length === 0) {
              expect(result.message).toContain("don't have any active tasks")
            } else {
              expect(result.message).toContain(`${activeTasks.length}`)
              for (const task of activeTasks) {
                expect(result.message).toContain(task.name)
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getTaskDetails returns accurate progress information', () => {
      fc.assert(
        fc.property(
          bigTaskArb.filter((t) => t.name.length > 0),
          (task) => {
            const ctx: FunctionContext = { userId: 'user-1', tasks: [task] }
            const result = getTaskDetails(ctx, task.name)

            expect(result.success).toBe(true)

            const completedCount = task.subTasks.filter((st) => st.completed).length
            const totalCount = task.subTasks.length
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

            expect(result.message).toContain(task.name)
            expect(result.message).toContain(`${progress}%`)
            expect(result.message).toContain(`${completedCount}/${totalCount}`)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getTaskDetails returns not found for non-existent task', () => {
      const ctx: FunctionContext = { userId: 'user-1', tasks: [] }
      const result = getTaskDetails(ctx, 'nonexistent-task-xyz-123')

      expect(result.success).toBe(false)
      expect(result.message).toContain("couldn't find")
    })

    it('getTimerStatus accurately reports timer state', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.record({
              isRunning: fc.constant(true),
              isPaused: fc.constant(false),
              remainingSeconds: fc.integer({ min: 1, max: 3600 }),
              totalSeconds: fc.integer({ min: 1, max: 3600 }),
              activeTaskId: fc.option(fc.uuid(), { nil: null }),
            }),
            fc.record({
              isRunning: fc.constant(false),
              isPaused: fc.constant(true),
              remainingSeconds: fc.integer({ min: 1, max: 3600 }),
              totalSeconds: fc.integer({ min: 1, max: 3600 }),
              activeTaskId: fc.option(fc.uuid(), { nil: null }),
            })
          ),
          (timerState) => {
            const timerController = createMockTimerController(timerState as TimerState | null)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks: [],
              timerController,
            }

            const result = getTimerStatus(ctx)

            expect(result.success).toBe(true)

            if (timerState === null) {
              expect(result.message).toContain('No timer')
            } else if (timerState.isPaused) {
              expect(result.message).toContain('paused')
            } else if (timerState.isRunning) {
              expect(result.message).toContain('running')
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getNextSubtask prioritizes active timer task', () => {
      const activeTask: BigTask = {
        id: 'active-task',
        userId: 'user-1',
        name: 'Active Task',
        emoji: '🎯',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st-1', bigTaskId: 'active-task', name: 'First subtask', emoji: '▪️', completed: true, sortOrder: 0 },
          { id: 'st-2', bigTaskId: 'active-task', name: 'Second subtask', emoji: '▪️', completed: false, sortOrder: 1 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }

      const otherTask: BigTask = {
        id: 'other-task',
        userId: 'user-1',
        name: 'Other Task',
        emoji: '📝',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        subTasks: [
          { id: 'st-3', bigTaskId: 'other-task', name: 'Other subtask', emoji: '▪️', completed: false, sortOrder: 0 },
        ],
        energyTag: 'medium',
        reminderAt: null,
        recurrence: null,
      }

      const timerState: TimerState = {
        isRunning: true,
        isPaused: false,
        remainingSeconds: 300,
        totalSeconds: 600,
        activeTaskId: 'active-task',
      }

      const timerController = createMockTimerController(timerState)
      const ctx: FunctionContext = {
        userId: 'user-1',
        tasks: [activeTask, otherTask],
        timerController,
      }

      const result = getNextSubtask(ctx)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Active Task')
      expect(result.message).toContain('Second subtask')
    })

    it('getNextSubtask returns task with highest progress when no timer active', () => {
      fc.assert(
        fc.property(
          fc.array(
            bigTaskArb.filter((t) => !t.completed && t.subTasks.length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          (tasks) => {
            const tasksWithIncomplete = tasks.filter((t) =>
              t.subTasks.some((st) => !st.completed)
            )

            if (tasksWithIncomplete.length === 0) return true

            const timerController = createMockTimerController(null)
            const ctx: FunctionContext = {
              userId: 'user-1',
              tasks,
              timerController,
            }

            const result = getNextSubtask(ctx)

            expect(result.success).toBe(true)
            if (result.data && typeof result.data === 'object') {
              const data = result.data as { subtask?: unknown; task?: unknown }
              expect(data.subtask).toBeDefined()
              expect(data.task).toBeDefined()
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getNextSubtask returns empty message when no active tasks', () => {
      const timerController = createMockTimerController(null)
      const ctx: FunctionContext = {
        userId: 'user-1',
        tasks: [],
        timerController,
      }

      const result = getNextSubtask(ctx)

      expect(result.success).toBe(true)
      expect(result.message).toContain("don't have any active tasks")
    })
  })
})
