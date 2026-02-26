import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  getRemainingMs,
  isTimerExpired,
  restartTimer,
  getBreakDuration,
  getNextIncompleteSubTask,
  type TimerState,
} from '../focusTimer'
import type { SubTask } from '../../types'

describe('Focus Timer Utilities', () => {
  /**
   * Feature: post-launch-improvements, Property 4: Timer remaining time correctness
   * Validates: Requirements 4.3, 4.13, 4.14
   * 
   * For any timer with a given duration and start time, getRemainingMs should return
   * a value equal to durationMs - elapsed, clamped to a minimum of 0. When the timer
   * is paused, getRemainingMs should return the remaining time at the moment of pause
   * regardless of how much wall-clock time has passed since.
   */
  it('Property 4: Timer remaining time correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 7200000 }), // 1 second to 2 hours
        fc.integer({ min: 0, max: 1000 }), // elapsed time in ms
        (durationMs, elapsedMs) => {
          // Test running timer
          const now = Date.now()
          const state: TimerState = {
            durationMs,
            startedAt: now - elapsedMs,
            pausedAt: null,
            isPomodoro: false,
            pomodoroCount: 0,
            isBreak: false,
          }

          const remaining = getRemainingMs(state)
          const expected = Math.max(0, durationMs - elapsedMs)
          
          // Allow small tolerance for timing variations
          expect(Math.abs(remaining - expected)).toBeLessThanOrEqual(10)
          expect(remaining).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 4: Paused timer remaining time stays constant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 7200000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }), // time since pause
        (durationMs, elapsedBeforePause, timeSincePause) => {
          const now = Date.now()
          const state: TimerState = {
            durationMs,
            startedAt: now - elapsedBeforePause - timeSincePause,
            pausedAt: now - timeSincePause,
            isPomodoro: false,
            pomodoroCount: 0,
            isBreak: false,
          }

          const remaining1 = getRemainingMs(state)
          
          // Wait a bit (simulated by checking again)
          const remaining2 = getRemainingMs(state)
          
          // Remaining time should be the same for paused timer
          expect(remaining1).toBe(remaining2)
          expect(remaining1).toBe(Math.max(0, durationMs - elapsedBeforePause))
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: post-launch-improvements, Property 5: Timer restart preserves duration
   * Validates: Requirements 4.6
   * 
   * For any timer that has expired, restarting the timer should produce a new timer
   * state with the same durationMs as the original, a fresh startedAt timestamp, and
   * pausedAt set to null.
   */
  it('Property 5: Timer restart preserves duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 7200000 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 10 }),
        (durationMs, isPomodoro, pomodoroCount) => {
          // Create an expired timer
          const originalState: TimerState = {
            durationMs,
            startedAt: Date.now() - durationMs - 1000, // expired 1 second ago
            pausedAt: null,
            isPomodoro,
            pomodoroCount,
            isBreak: false,
          }

          expect(isTimerExpired(originalState)).toBe(true)

          const restartedState = restartTimer(originalState)

          // Duration should be preserved
          expect(restartedState.durationMs).toBe(originalState.durationMs)
          
          // Should have fresh startedAt (within reasonable tolerance)
          expect(Math.abs(restartedState.startedAt - Date.now())).toBeLessThanOrEqual(10)
          
          // pausedAt should be null
          expect(restartedState.pausedAt).toBe(null)
          
          // Other properties should be preserved
          expect(restartedState.isPomodoro).toBe(originalState.isPomodoro)
          expect(restartedState.pomodoroCount).toBe(originalState.pomodoroCount)
          expect(restartedState.isBreak).toBe(originalState.isBreak)
          
          // Timer should not be expired after restart
          expect(isTimerExpired(restartedState)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: post-launch-improvements, Property 6: Pomodoro break duration
   * Validates: Requirements 4.7, 4.8
   * 
   * For any Pomodoro session with a completed work interval count N, the break
   * duration should be 5 minutes when N is not a multiple of 4, and 15 minutes
   * when N is a multiple of 4 (and N > 0).
   */
  it('Property 6: Pomodoro break duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // pomodoro count
        (pomodoroCount) => {
          const breakDuration = getBreakDuration(pomodoroCount)
          
          if (pomodoroCount > 0 && pomodoroCount % 4 === 0) {
            // After every 4 intervals, should be 15 minutes
            expect(breakDuration).toBe(15 * 60 * 1000)
          } else {
            // Otherwise, should be 5 minutes
            expect(breakDuration).toBe(5 * 60 * 1000)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6: Zero pomodoro count gives 5 minute break', () => {
    const breakDuration = getBreakDuration(0)
    expect(breakDuration).toBe(5 * 60 * 1000)
  })

  /**
   * Feature: post-launch-improvements, Property 7: Next incomplete Sub-Task selection
   * Validates: Requirements 4.10
   * 
   * For any list of Sub-Tasks where at least one is incomplete, the "next incomplete"
   * function should return the first Sub-Task (by sort order) that is not marked as
   * completed. When all Sub-Tasks are complete, the function should return null.
   */
  it('Property 7: Next incomplete Sub-Task selection', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            bigTaskId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            emoji: fc.constantFrom('✅', '🎯', '📝', '🔥'),
            completed: fc.boolean(),
            sortOrder: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (subTasks) => {
          const result = getNextIncompleteSubTask(subTasks)
          const incompleteSubTasks = subTasks.filter(st => !st.completed)

          if (incompleteSubTasks.length === 0) {
            // All complete -> should return null
            expect(result).toBe(null)
          } else {
            // Should return the first incomplete by sort order
            const sortedIncomplete = incompleteSubTasks.sort((a, b) => a.sortOrder - b.sortOrder)
            expect(result).not.toBe(null)
            expect(result?.id).toBe(sortedIncomplete[0].id)
            expect(result?.completed).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 7: All complete returns null', () => {
    const allComplete: SubTask[] = [
      { id: '1', bigTaskId: 'task1', name: 'Task 1', emoji: '✅', completed: true, sortOrder: 0 },
      { id: '2', bigTaskId: 'task1', name: 'Task 2', emoji: '✅', completed: true, sortOrder: 1 },
      { id: '3', bigTaskId: 'task1', name: 'Task 3', emoji: '✅', completed: true, sortOrder: 2 },
    ]
    expect(getNextIncompleteSubTask(allComplete)).toBe(null)
  })

  it('Property 7: Returns first incomplete by sort order', () => {
    const mixed: SubTask[] = [
      { id: '1', bigTaskId: 'task1', name: 'Task 1', emoji: '✅', completed: true, sortOrder: 0 },
      { id: '2', bigTaskId: 'task1', name: 'Task 2', emoji: '📝', completed: false, sortOrder: 2 },
      { id: '3', bigTaskId: 'task1', name: 'Task 3', emoji: '🔥', completed: false, sortOrder: 1 },
    ]
    const result = getNextIncompleteSubTask(mixed)
    expect(result?.id).toBe('3') // sortOrder 1 comes before sortOrder 2
  })
})
