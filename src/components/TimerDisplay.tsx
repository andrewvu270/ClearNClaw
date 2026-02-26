interface TimerDisplayProps {
  remainingSeconds: number
  totalSeconds: number
  onStop: () => void
}

export function TimerDisplay({ remainingSeconds, totalSeconds, onStop }: TimerDisplayProps) {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0

  // Calculate stroke dasharray for circular progress
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col items-center">
      <div className="relative w-32 h-32">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-base-700"
          />
          {/* Progress circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-neon-cyan transition-all duration-1000 ease-linear"
            strokeLinecap="round"
          />
        </svg>

        {/* Timer text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-mono text-white">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="mt-3 px-4 py-2 bg-base-700 text-gray-300 rounded hover:bg-base-600 transition-colors text-sm"
      >
        Stop Timer
      </button>
    </div>
  )
}
