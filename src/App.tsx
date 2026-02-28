import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './lib/supabase'
import { ensureProfile } from './services/profileService'
import { StimModeProvider } from './contexts/StimModeContext'
import { FocusTimerProvider } from './contexts/FocusTimerContext'
import { VoiceCallProvider, useVoiceCall } from './contexts/VoiceCallContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GlobalNowActiveBar } from './components/GlobalNowActiveBar'
import { FloatingCallIndicator } from './components/FloatingCallIndicator'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { TasksPage } from './pages/TasksPage'
import { ClawMachinePage } from './pages/ClawMachinePage'
import { ProfilePage } from './pages/ProfilePage'
import { AssistantPage } from './pages/AssistantPage'

/** Funny messages for auto-ended calls (silence or max duration) */
const AUTO_END_MESSAGES = [
  "📞 Call ended — Klaw got bored of the silence.",
  "🎤 Klaw hung up. Too quiet over there!",
  "😴 Call auto-ended. Klaw needs stimulation!",
  "🤖 Klaw disconnected. Say something next time!",
  "📴 Call dropped — the void was too loud.",
]

function AuthListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        ensureProfile(session.user.id)
          .catch(console.error)
          .finally(() => navigate('/tasks', { replace: true }))
      }
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        navigate('/', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // When PWA regains focus, re-check session (handles magic link opened in Safari)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            navigate('/tasks', { replace: true })
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [navigate])

  return null
}

function AppRoutes() {
  const location = useLocation()
  const isClawPage = location.pathname === '/claw-machine'
  const voiceCall = useVoiceCall()
  const [toast, setToast] = useState<string | null>(null)

  // Show toast when call auto-ends (silence timeout or max duration)
  useEffect(() => {
    if (voiceCall.endReason === 'auto') {
      const msg = AUTO_END_MESSAGES[Math.floor(Math.random() * AUTO_END_MESSAGES.length)]
      setToast(msg)
      voiceCall.clearEndReason()
    }
  }, [voiceCall.endReason, voiceCall.clearEndReason])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timeout)
  }, [toast])

  return (
    <>
      {/* Claw machine stays mounted, hidden when not on its route */}
      <div
        style={{
          visibility: isClawPage ? 'visible' : 'hidden',
          position: isClawPage ? 'relative' : 'fixed',
          top: isClawPage ? undefined : 0,
          left: isClawPage ? undefined : 0,
          width: isClawPage ? undefined : '100%',
          height: isClawPage ? undefined : '100%',
          pointerEvents: isClawPage ? 'auto' : 'none',
          zIndex: isClawPage ? undefined : -1,
        }}
      >
        <ProtectedRoute><ClawMachinePage active={isClawPage} /></ProtectedRoute>
      </div>

      {/* Other routes mount/unmount normally */}
      {!isClawPage && (
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}

      {/* Global Now-Active Bar — visible on all pages when timer is active */}
      <GlobalNowActiveBar />

      {/* Floating Call Indicator — visible when voice call active and not on AssistantPage */}
      <FloatingCallIndicator />

      {/* Global toast for voice call max duration */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 inset-x-0 mx-auto w-fit z-[70] px-5 py-2.5 bg-base-800/90 backdrop-blur-sm border border-neon-cyan/20 rounded-2xl text-white text-sm font-body shadow-lg max-w-[85vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <StimModeProvider>
        <FocusTimerProvider>
          <VoiceCallProvider>
            <AuthListener />
            <AppRoutes />
          </VoiceCallProvider>
        </FocusTimerProvider>
      </StimModeProvider>
    </BrowserRouter>
  )
}

export default App
