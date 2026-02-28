import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import { NowActiveBar } from './NowActiveBar'

export function GlobalNowActiveBar() {
  const timer = useFocusTimer()
  const navigate = useNavigate()

  // Show bar when timer is running/paused (with or without active task)
  const showBar = timer.isRunning || timer.isPaused

  const handleClick = () => {
    if (timer.activeTask) {
      navigate('/tasks', { state: { focusTaskId: timer.activeTask.id } })
    } else {
      navigate('/focus')
    }
  }

  const handleCancel = () => {
    timer.stop()
  }

  return (
    <AnimatePresence>
      {showBar && (
        <NowActiveBar
          task={timer.activeTask}
          remainingSeconds={timer.remainingSeconds}
          isPaused={timer.isPaused}
          onClick={handleClick}
          onCancel={handleCancel}
        />
      )}
    </AnimatePresence>
  )
}
