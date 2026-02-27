interface StreakBadgeProps {
  streak: number
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak <= 0) return null

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30"
      aria-label={`${streak} day streak`}
    >
      🔥 {streak}
    </span>
  )
}
