import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/tasks', label: 'Tasks', icon: '🎯' },
  { path: '/claw-machine', label: 'Claw', icon: '🐻' },
  { path: '/profile', label: 'Profile', icon: '👾' },
] as const

export function BottomNavBar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 22, 40, 0.45) 0%, rgba(5, 12, 25, 0.7) 100%)',
        backdropFilter: 'blur(28px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 -12px 48px rgba(0, 229, 255, 0.05), 0 -4px 16px rgba(255, 107, 157, 0.03)',
      }}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '128px 128px',
        }}
      />

      <div className="relative flex justify-around items-center max-w-lg mx-auto">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center justify-center py-1 px-4 min-w-[40px] min-h-[40px] transition-all duration-300 ${
                isActive
                  ? 'text-neon-cyan'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Multi-color glow behind active icon */}
              {isActive && (
                <>
                  <span
                    className="absolute top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full opacity-15 bg-neon-cyan blur-lg pointer-events-none"
                  />
                  <span
                    className="absolute top-6 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full opacity-10 bg-neon-pink blur-md pointer-events-none"
                  />
                </>
              )}

              <span
                className={`relative text-xl transition-transform duration-300 ${isActive ? 'scale-150' : 'scale-100 opacity-60'}`}
                role="img"
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-pixel mt-1 transition-all duration-300 ${
                  isActive
                    ? 'drop-shadow-[0_0_6px_rgba(0,229,255,0.6)]'
                    : ''
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
