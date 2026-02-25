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
    <nav className="fixed bottom-0 left-0 right-0 bg-base-800 border-t border-base-700 z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center py-2 px-4 min-w-[44px] min-h-[44px] transition-colors ${
                isActive ? 'text-neon-cyan' : 'text-gray-400 hover:text-gray-200'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl" role="img" aria-hidden="true">{tab.icon}</span>
              <span className="text-[10px] font-pixel mt-1">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
