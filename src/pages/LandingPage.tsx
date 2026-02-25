import { lazy, Suspense, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StackCards } from '../components/StackCards'
import { Aurora } from '../components/Aurora'
import Shuffle from '../components/Shuffle'

const ThreeBackground = lazy(() => import('../components/ThreeBackground'))

export function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/tasks', { replace: true })
    })
  }, [navigate])

  // Always show animations on landing page regardless of low-stim mode
  useEffect(() => {
    document.documentElement.classList.remove('low-stim')
  }, [])

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Aurora background on all screens */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <Aurora
          colorStops={['#00e5ff', '#064e3b', '#ff1493']}
          amplitude={1.2}
          blend={0.6}
          speed={0.8}
        />
      </div>
      {/* Three.js shapes on desktop only */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <ThreeBackground />
        </div>
      </Suspense>

      <div className="relative z-10 max-w-lg w-full text-center">
        <h1 className="text-white text-6xl md:text-8xl font-pixel mb-3 tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          <Shuffle
            text="Clear & Claw"
            shuffleDirection="right"
            duration={0.35}
            animationMode="evenodd"
            shuffleTimes={1}
            ease="power3.out"
            stagger={0.03}
            threshold={0.1}
            triggerOnce={true}
            triggerOnHover
            respectReducedMotion={true}
            loop={false}
            tag="span"
            className="text-white font-pixel"
            style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
          />
        </h1>
        <p className="text-gray-300 text-sm md:text-base font-body mb-12 tracking-wide">
          Task Management For Brains That Don't Do Boring
        </p>

        <div className="flex justify-center mb-12">
          <div className="w-64 h-52">
            <StackCards
              sensitivity={150}
              cards={[
                <div className="bg-base-800/90 backdrop-blur-sm rounded-xl border border-base-700/50 px-5 py-5 w-full h-full flex flex-col items-center justify-center text-center">
                  <div className="text-5xl mb-3">🧸</div>
                  <span className="text-neon-pink font-pixel text-[10px] tracking-wider">03 — grab loot</span>
                  <p className="text-neon-pink/70 text-[11px] font-pixel mt-2">blow coins on the claw machine — collect weird little toys</p>
                </div>,
                <div className="bg-base-800/90 backdrop-blur-sm rounded-xl border border-base-700/50 px-5 py-5 w-full h-full flex flex-col items-center justify-center text-center">
                  <div className="text-5xl mb-3">🪙</div>
                  <span className="text-neon-yellow font-pixel text-[10px] tracking-wider">02 — stack coins</span>
                  <p className="text-neon-yellow/70 text-[11px] font-pixel mt-2">finish steps, earn coins for every win</p>
                </div>,
                <div className="bg-base-800/90 backdrop-blur-sm rounded-xl border border-base-700/50 px-5 py-5 w-full h-full flex flex-col items-center justify-center text-center">
                  <div className="text-5xl mb-3">🎯</div>
                  <span className="text-neon-green font-pixel text-[10px] tracking-wider">01 — break it down</span>
                  <p className="text-neon-green/70 text-[11px] font-pixel mt-2">drop a task — AI splits it into steps you can actually do</p>
                </div>,
              ]}
            />
          </div>
        </div>

        <button
          onClick={() => navigate('/sign-in')}
          className="min-h-[48px] w-full max-w-xs px-8 py-3 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan font-pixel text-sm rounded-lg border border-neon-cyan/30 transition-all"
        >
          get started
        </button>

        <p className="text-gray-600 text-[10px] font-body mt-8">
          built for ADHD. works for everyone.
        </p>
      </div>
    </div>
  )
}
