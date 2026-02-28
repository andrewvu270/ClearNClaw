import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useFocusTimer } from '../contexts/FocusTimerContext'
import { useVoiceCall } from '../contexts/VoiceCallContext'
import { NowActiveBar } from './NowActiveBar'

export function GlobalNowActiveBar() {
  const timer = useFocusTimer()
  const navigate = useNavigate()
  const { voiceState } = useVoiceCall()

  // Hide timer bar when voice call is active (call bar takes priority in same slot)
  const isCallActive = voiceState === 'active' || voiceState === 'connecting'

  // Show bar when timer is running/paused AND no active call
  const showBar = (timer.isRunning || timer.isPaused) && !isCallActive

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
