import { lazy, Suspense, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ThreeBackground = lazy(() => import('../components/ThreeBackground'))

export function SignInPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/tasks', { replace: true })
    })
  }, [navigate])

  const handleSignIn = async (provider: 'google' | 'github') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/tasks' },
    })
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Three.js background */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 -z-10">
          <ThreeBackground />
        </div>
      </Suspense>

      {/* Sign-in card */}
      <div className="relative z-10 bg-base-800/90 backdrop-blur-sm rounded-2xl border border-base-700 p-8 max-w-sm w-full mx-4 shadow-2xl shadow-black/40">
        <h1 className="text-neon-cyan text-sm text-center mb-2">ADHD Task Breaker</h1>
        <p className="text-gray-400 text-xs font-body text-center mb-8">
          Break big tasks into small wins
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handleSignIn('google')}
            className="w-full min-h-[44px] flex items-center justify-center gap-3 bg-base-700 hover:bg-base-600 text-white font-body text-sm rounded-xl border border-base-600 transition-colors px-4 py-3"
          >
            <span>🔵</span> Sign in with Google
          </button>
          <button
            onClick={() => handleSignIn('github')}
            className="w-full min-h-[44px] flex items-center justify-center gap-3 bg-base-700 hover:bg-base-600 text-white font-body text-sm rounded-xl border border-base-600 transition-colors px-4 py-3"
          >
            <span>⚫</span> Sign in with GitHub
          </button>
        </div>
      </div>
    </div>
  )
}
