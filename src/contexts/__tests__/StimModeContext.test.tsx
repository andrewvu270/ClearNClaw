import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { StimModeProvider, useStimMode } from '../StimModeContext'
import fc from 'fast-check'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}))

describe('StimModeContext', () => {
  beforeEach(() => {
    // Clean up document class
    document.documentElement.classList.remove('low-stim')
    vi.clearAllMocks()
  })

  /**
   * **Feature: post-launch-improvements, Property 3: Low Stimulation Mode round-trip**
   * **Validates: Requirements 2.4**
   * 
   * For any initial Low Stimulation Mode state (enabled or disabled), toggling the mode
   * and then toggling it back should restore the original state.
   */
  it('property: toggle twice returns to original state', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (initialState) => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <StimModeProvider>{children}</StimModeProvider>
        )

        const { result } = renderHook(() => useStimMode(), { wrapper })

        // Wait for initialization
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 0))
        })

        // Set initial state
        await act(async () => {
          result.current.setLowStim(initialState)
        })

        const stateAfterInit = result.current.isLowStim

        // Toggle twice
        await act(async () => {
          result.current.toggle()
        })

        await act(async () => {
          result.current.toggle()
        })

        const stateAfterDoubleToggle = result.current.isLowStim

        // Should return to original state
        expect(stateAfterDoubleToggle).toBe(stateAfterInit)
      }),
      { numRuns: 100 }
    )
  })
})
