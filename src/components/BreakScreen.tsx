interface BreakScreenProps {
  remainingSeconds: number
  onSkip: () => void
}

export function BreakScreen({ remainingSeconds, onSkip }: BreakScreenProps) {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#7ec8c8]/20 to-[#8ab88a]/20 backdrop-blur-md">
      <div className="text-center space-y-8 px-4">
        {/* Break icon */}
        <div className="text-6xl">☕</div>

        {/* Break message */}
        <div className="space-y-2">
          <h2 className="text-3xl text-white font-light">Take a Break</h2>
          <p className="text-gray-300 text-lg">
            You've earned it. Stretch, breathe, relax.
          </p>
        </div>

        {/* Break timer */}
        <div className="text-5xl font-mono text-white">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-[#7ec8c8]/20 text-[#7ec8c8] border border-[#7ec8c8] rounded-lg hover:bg-[#7ec8c8]/30 transition-colors"
        >
          Skip Break
        </button>
      </div>
    </div>
  )
}
