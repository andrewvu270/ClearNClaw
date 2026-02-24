interface EmptyStateProps {
  emoji?: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ emoji = '✨', message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <span className="text-5xl mb-4" role="img" aria-hidden="true">{emoji}</span>
      <p className="text-gray-300 font-body text-sm max-w-xs mb-4">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 min-h-[44px] bg-neon-cyan/20 text-neon-cyan font-pixel text-xs rounded-lg border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
