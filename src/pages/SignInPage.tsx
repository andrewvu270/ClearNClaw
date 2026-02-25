import { lazy, Suspense, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Aurora } from '../components/Aurora'

const ThreeBackground = lazy(() => import('../components/ThreeBackground'))

export function SignInPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/tasks', { replace: true })
    })
  }, [navigate])

  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleSendOtp = async () => {
    const trimmed = email.trim()
    if (!trimmed) { setError('Please enter your email'); return }
    setLoading(true)
    setError('')
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
    })
    setLoading(false)
    if (otpError) { setError(otpError.message); return }
    setOtpSent(true)
  }

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setError('')

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5 && newOtp.every(d => d)) {
      verifyOtp(newOtp.join(''))
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newOtp = [...otp]
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i]
    }
    setOtp(newOtp)
    if (pasted.length === 6) {
      verifyOtp(pasted)
    } else {
      inputRefs.current[pasted.length]?.focus()
    }
  }

  const verifyOtp = async (token: string) => {
    setLoading(true)
    setError('')
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    setLoading(false)
    if (verifyError) {
      setError(verifyError.message)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
    // AuthListener in App.tsx handles navigation on SIGNED_IN
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <Aurora
          colorStops={['#00e5ff', '#064e3b', '#ff1493']}
          amplitude={1.2}
          blend={0.6}
          speed={0.8}
        />
      </div>
      <Suspense fallback={null}>
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <ThreeBackground />
        </div>
      </Suspense>

      <div className="relative z-10 bg-base-800/90 backdrop-blur-sm rounded-2xl border border-base-700 p-8 max-w-sm w-full mx-4 shadow-2xl shadow-black/40">
        <h1 className="text-neon-cyan text-sm text-center mb-2">Clear & Claw</h1>
        <p className="text-gray-400 text-xs font-body text-center mb-8">
          Break big tasks into small wins
        </p>

        {!otpSent ? (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSendOtp() }}
              placeholder="you@email.com"
              className="w-full bg-base-900 text-white text-sm px-4 py-3 rounded-xl border border-base-700 outline-none focus:border-neon-cyan/50 placeholder-gray-600"
              aria-label="Email address"
            />
            {error && <p className="text-neon-pink text-xs px-1">{error}</p>}
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full min-h-[44px] flex items-center justify-center bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan font-body text-sm rounded-xl border border-neon-cyan/30 transition-colors px-4 py-3 disabled:opacity-50"
            >
              {loading ? '...' : 'Send Code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-xs font-body text-center">
              Enter the 6-digit code sent to<br />
              <span className="text-neon-cyan">{email}</span>
            </p>
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-10 h-12 text-center text-lg font-pixel bg-base-900 text-white rounded-lg border border-base-700 outline-none focus:border-neon-cyan/50"
                  aria-label={`Digit ${i + 1}`}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {error && <p className="text-neon-pink text-xs text-center px-1">{error}</p>}
            {loading && <p className="text-gray-500 text-xs text-center">Verifying...</p>}
            <button
              onClick={() => { setOtpSent(false); setOtp(['', '', '', '', '', '']); setError('') }}
              className="w-full text-gray-500 text-xs font-body hover:text-gray-300 transition-colors py-2"
            >
              ← Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
