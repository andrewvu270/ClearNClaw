import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { supabase } from './lib/supabase'
import { ensureProfile } from './services/profileService'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PageTransition } from './components/PageTransition'
import { SignInPage } from './pages/SignInPage'
import { TasksPage } from './pages/TasksPage'
import { ClawMachinePage } from './pages/ClawMachinePage'
import { ProfilePage } from './pages/ProfilePage'

function AuthListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        ensureProfile(session.user.id).catch(console.error)
        navigate('/tasks', { replace: true })
      }

      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        navigate('/sign-in', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/sign-in" element={<PageTransition><SignInPage /></PageTransition>} />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <PageTransition><TasksPage /></PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/claw-machine"
          element={
            <ProtectedRoute>
              <PageTransition><ClawMachinePage /></PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PageTransition><ProfilePage /></PageTransition>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthListener />
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

export default App
