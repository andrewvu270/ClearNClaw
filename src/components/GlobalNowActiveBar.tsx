import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import { NowActiveBar } from './NowActiveBar'

export function GlobalNowActiveBar() {
  const timer = useFocusTimer()
  const navigate = useNavigate()

  const showBar = (timer.isRunning || timer.isPaused) && timer.activeTask !== null

  const handleClick = () => {
    if (timer.activeTask) {
      navigate('/tasks', { state: { focusTaskId: timer.activeTask.id } })
    } else {
      navigate('/tasks')
    }
  }

  const handleCancel = () => {
    timer.stop()
  }

  return (
    <AnimatePresence>
      {showBar && timer.activeTask && (
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
