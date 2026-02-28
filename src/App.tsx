import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ensureProfile } from './services/profileService'
import { StimModeProvider } from './contexts/StimModeContext'
import { FocusTimerProvider } from './contexts/FocusTimerContext'
import { VoiceCallProvider } from './contexts/VoiceCallContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GlobalNowActiveBar } from './components/GlobalNowActiveBar'
import { FloatingCallIndicator } from './components/FloatingCallIndicator'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { TasksPage } from './pages/TasksPage'
import { ClawMachinePage } from './pages/ClawMachinePage'
import { ProfilePage } from './pages/ProfilePage'
import { AssistantPage } from './pages/AssistantPage'

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
