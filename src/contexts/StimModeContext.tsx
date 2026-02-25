import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface StimModeContextValue {
  isLowStim: boolean
  toggle: () => void
  setLowStim: (value: boolean) => void
}

const StimModeContext = createContext<StimModeContextValue | undefined>(undefined)

export function StimModeProvider({ children }: { children: ReactNode }) {
  const [isLowStim, setIsLowStimState] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Initialize: read from Supabase profile and check prefers-reduced-motion
  useEffect(() => {
    const initializeStimMode = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setUserId(session.user.id)

      // Read from Supabase profile
      const { data, error } = await supabase
        .from('profiles')
        .select('low_stim_mode')
        .eq('id', session.user.id)
        .single()

      if (error) {
        console.error('Failed to load low stim mode preference:', error)
        // Fall back to prefers-reduced-motion for first-time default
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        setIsLowStimState(prefersReducedMotion)
        return
      }

      const lowStimMode = data?.low_stim_mode ?? false
      setIsLowStimState(lowStimMode)

      // Apply class to document element
      if (lowStimMode) {
        document.documentElement.classList.add('low-stim')
      }
    }

    initializeStimMode()
  }, [])

  const setLowStim = async (value: boolean) => {
    setIsLowStimState(value)

    // Toggle class on document element
    if (value) {
      document.documentElement.classList.add('low-stim')
    } else {
      document.documentElement.classList.remove('low-stim')
    }

    // Persist to Supabase
    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ low_stim_mode: value })
        .eq('id', userId)

      if (error) {
        console.error('Failed to persist low stim mode preference:', error)
      }
    }
  }

  const toggle = () => {
    setLowStim(!isLowStim)
  }

  return (
    <StimModeContext.Provider value={{ isLowStim, toggle, setLowStim }}>
      {children}
    </StimModeContext.Provider>
  )
}

export function useStimMode() {
  const context = useContext(StimModeContext)
  if (context === undefined) {
    throw new Error('useStimMode must be used within a StimModeProvider')
  }
  return context
}
