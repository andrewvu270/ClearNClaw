import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  createTimerState,
  getRemainingMs,
  isTimerExpired,
  pauseTimer as pauseTimerUtil,
  resumeTimer as resumeTimerUtil,
  type TimerState,
} from '../utils/focusTimer'
import type { BigTask } from '../types'

interface FocusTimerContextValue {
  remainingSeconds: number
  totalSeconds: number
  isRunning: boolean
  isPaused: boolean
  isPomodoro: boolean
  pomodoroCount: number
  isBreak: boolean
  activeTask: BigTask | null
  setActiveTask: (task: BigTask | null) => void
  start: (durationMs: number, pomodoro?: boolean) => void
  stop: () => void
  pause: () => void
  resume: () => void
}

const FocusTimerContext = createContext<FocusTimerContextValue | undefined>(undefined)

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [activeTask, setActiveTask] = useState<BigTask | null>(null)

  // Update remaining time using requestAnimationFrame for smooth updates
  useEffect(() => {
    if (!timerState || timerState.pausedAt !== null) {
      return
    }

    let animationFrameId: number

    const updateRemaining = () => {
      const remainingMs = getRemainingMs(timerState)
      setRemainingSeconds(Math.ceil(remainingMs / 1000))

      if (!isTimerExpired(timerState)) {
        animationFrameId = requestAnimationFrame(updateRemaining)
      }
    }

    animationFrameId = requestAnimationFrame(updateRemaining)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [timerState])

  const start = useCallback((durationMs: number, pomodoro: boolean = false) => {
    const newState = createTimerState(durationMs, pomodoro)
    setTimerState(newState)
    setRemainingSeconds(Math.ceil(durationMs / 1000))
    setTotalSeconds(Math.ceil(durationMs / 1000))
  }, [])

  const stop = useCallback(() => {
    setTimerState(null)
    setRemainingSeconds(0)
    setTotalSeconds(0)
    setActiveTask(null)
  }, [])

  const pause = useCallback(() => {
    if (timerState) {
      const pausedState = pauseTimerUtil(timerState)
      setTimerState(pausedState)
      const remainingMs = getRemainingMs(pausedState)
      setRemainingSeconds(Math.ceil(remainingMs / 1000))
    }
  }, [timerState])

  const resume = useCallback(() => {
    if (timerState) {
      const resumedState = resumeTimerUtil(timerState)
      setTimerState(resumedState)
    }
  }, [timerState])

  const value: FocusTimerContextValue = {
    remainingSeconds,
    totalSeconds,
    isRunning: timerState !== null && timerState.pausedAt === null,
    isPaused: timerState !== null && timerState.pausedAt !== null,
    isPomodoro: timerState?.isPomodoro ?? false,
    pomodoroCount: timerState?.pomodoroCount ?? 0,
    isBreak: timerState?.isBreak ?? false,
    activeTask,
    setActiveTask,
    start,
    stop,
    pause,
    resume,
  }

  return (
    <FocusTimerContext.Provider value={value}>
      {children}
    </FocusTimerContext.Provider>
  )
}

export function useFocusTimer() {
  const context = useContext(FocusTimerContext)
  if (context === undefined) {
    throw new Error('useFocusTimer must be used within a FocusTimerProvider')
  }
  return context
}
