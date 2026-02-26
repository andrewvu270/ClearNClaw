import type { BigTask } from '../types'

export interface AutoSwapResult {
  shouldStopExisting: boolean
  newActiveTask: BigTask
  toastMessage: string | null
}

/**
 * Determines the auto-swap behavior when a user clicks a task card
 * while a timer may already be active on another task.
 *
 * Rules:
 * - If a timer is active (running or paused) on a different task, stop it and switch
 * - If no timer is active, or the same task is clicked, no swap needed
 * - After swap, exactly one task is the active focus target
 */
export function computeAutoSwap(
  clickedTask: BigTask,
  timerIsRunning: boolean,
  timerIsPaused: boolean,
  activeTimerTask: BigTask | null,
): AutoSwapResult {
  const timerActive = timerIsRunning || timerIsPaused
  const switchingTask = activeTimerTask !== null && activeTimerTask.id !== clickedTask.id

  if (timerActive && switchingTask) {
    return {
      shouldStopExisting: true,
      newActiveTask: clickedTask,
      toastMessage: `Switched focus to ${clickedTask.name}`,
    }
  }

  return {
    shouldStopExisting: false,
    newActiveTask: clickedTask,
    toastMessage: null,
  }
}
