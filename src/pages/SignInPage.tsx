import { lazy, Suspense, useEffect, useState } from 'react'
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

  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')

  const handleEmailSignIn = async () => {
    const trimmed = email.trim()
    if (!trimmed) { setEmailError('Please enter your email'); return }
    setEmailLoading(true)
    setEmailError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin + '/tasks' },
    })
    setEmailLoading(false)
    if (error) { setEmailError(error.message); return }
    setEmailSent(true)
  }

  const handleOAuth = async (provider: 'github') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/tasks' },
    })
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <Suspense fallback={null}>
        <div className="absolute inset-0 -z-10">
          <ThreeBackground />
        </div>
      </Suspense>

      <div className="relative z-10 bg-base-800/90 backdrop-blur-sm rounded-2xl border border-base-700 p-8 max-w-sm w-full mx-4 shadow-2xl shadow-black/40">
        <h1 className="text-neon-cyan text-sm text-center mb-2">ADHD Task Breaker</h1>
        <p className="text-gray-400 text-xs font-body text-center mb-8">
          Break big tasks into small wins
        </p>

        {emailSent ? (
          <div className="text-center">
            <p className="text-neon-green text-xs font-body mb-2">Magic link sent!</p>
            <p className="text-gray-400 text-[11px] font-body">Check your inbox for {email}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !emailLoading) handleEmailSignIn() }}
              placeholder="you@email.com"
              className="w-full bg-base-900 text-white text-sm px-4 py-3 rounded-xl border border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600"
              aria-label="Email address"
            />
            {emailError && <p className="text-neon-pink text-xs px-1">{emailError}</p>}
            <button
              onClick={handleEmailSignIn}
              disabled={emailLoading}
              className="w-full min-h-[44px] flex items-center justify-center bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan font-body text-sm rounded-xl border border-neon-cyan/30 transition-colors px-4 py-3 disabled:opacity-50"
            >
              {emailLoading ? '...' : 'Sign in with Email'}
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-base-700" />
              <span className="text-gray-500 text-[10px] font-body">or</span>
              <div className="flex-1 h-px bg-base-700" />
            </div>

            <button
              onClick={() => handleOAuth('github')}
              className="w-full min-h-[44px] flex items-center justify-center bg-base-700 hover:bg-base-600 text-white font-body text-sm rounded-xl border border-base-600 transition-colors px-4 py-3"
            >
              Sign in with GitHub
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
