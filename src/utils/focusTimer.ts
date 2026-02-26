import type { SubTask } from '../types'

export interface TimerState {
  durationMs: number
  startedAt: number       // Date.now() timestamp
  pausedAt: number | null
  isPomodoro: boolean
  pomodoroCount: number   // completed work intervals
  isBreak: boolean
}

/**
 * Creates a new timer state
 */
export function createTimerState(
  durationMs: number,
  isPomodoro: boolean = false
): TimerState {
  return {
    durationMs,
    startedAt: Date.now(),
    pausedAt: null,
    isPomodoro,
    pomodoroCount: 0,
    isBreak: false,
  }
}

/**
 * Gets the remaining time in milliseconds for a timer
 * Accounts for paused state and background time
 */
export function getRemainingMs(state: TimerState): number {
  if (state.pausedAt) {
    return Math.max(0, state.durationMs - (state.pausedAt - state.startedAt))
  }
  return Math.max(0, state.durationMs - (Date.now() - state.startedAt))
}

/**
 * Checks if a timer has expired
 */
export function isTimerExpired(state: TimerState): boolean {
  return getRemainingMs(state) === 0
}

/**
 * Pauses a running timer
 */
export function pauseTimer(state: TimerState): TimerState {
  if (state.pausedAt !== null) {
    return state // already paused
  }
  return {
    ...state,
    pausedAt: Date.now(),
  }
}

/**
 * Resumes a paused timer
 */
export function resumeTimer(state: TimerState): TimerState {
  if (state.pausedAt === null) {
    return state // not paused
  }
  const pausedDuration = Date.now() - state.pausedAt
  return {
    ...state,
    startedAt: state.startedAt + pausedDuration,
    pausedAt: null,
  }
}

/**
 * Restarts a timer with the same duration
 */
export function restartTimer(state: TimerState): TimerState {
  return {
    ...state,
    startedAt: Date.now(),
    pausedAt: null,
  }
}

/**
 * Gets the break duration based on completed Pomodoro intervals
 * 5 minutes normally, 15 minutes after every 4 intervals
 */
export function getBreakDuration(pomodoroCount: number): number {
  if (pomodoroCount > 0 && pomodoroCount % 4 === 0) {
    return 15 * 60 * 1000 // 15 minutes
  }
  return 5 * 60 * 1000 // 5 minutes
}

/**
 * Gets the next incomplete sub-task by sort order
 * Returns null if all sub-tasks are complete
 */
export function getNextIncompleteSubTask(subTasks: SubTask[]): SubTask | null {
  const incomplete = subTasks
    .filter(st => !st.completed)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  
  return incomplete.length > 0 ? incomplete[0] : null
}
