import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { BottomNavBar } from '../components/BottomNavBar'
import DotGrid from '../components/DotGrid'
import * as coinService from '../services/coinService'
// @ts-expect-error — ClawMachine is a JSX component without types
import ClawMachine from '../components/ClawMachine'

export function ClawMachinePage({ active = true }: { active?: boolean }) {
  const [coins, setCoins] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [resetCount, setResetCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        coinService.getCoinBalance(session.user.id).then(setCoins)
        // Fetch reset count
        supabase
          .from('profiles')
          .select('claw_reset_count')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setResetCount(data.claw_reset_count || 0)
          })
      }
    })
    // Show refill toast on mount
    setToast('🎰 Toys restocked! The claw hungers...')
  }, [])

  // Scroll to top whenever the claw page becomes active
  useEffect(() => {
    if (active) {
      window.scrollTo(0, 0)
    }
  }, [active])

  // Refresh coin balance whenever the page becomes visible
  useEffect(() => {
    if (active && userId) {
      coinService.getCoinBalance(userId).then(setCoins)
    }
  }, [active, userId])

  // Generate seed from userId + date + resetCount
  const seed = useMemo(() => {
    if (!userId) return undefined
    const today = new Date().toISOString().split('T')[0]
    return `${userId}-${today}-${resetCount}`
  }, [userId, resetCount])

  const handlePlay = async () => {
    if (!userId || coins === null || coins <= 0 || playing) return
    const success = await coinService.spendCoin(userId)
    if (!success) {
      setMessage('No coins! Complete tasks to earn more.')
      return
    }
    setCoins(prev => (prev !== null ? prev - 1 : 0))
    setMessage('')
    setPlaying(true)
  }

  const handleRefreshToys = async () => {
    if (!userId || coins === null || coins < 5 || playing) return

    // Spend 5 coins and increment reset count
    const { error } = await supabase.rpc('refresh_claw_toys', { p_user_id: userId })

    if (error) {
      setToast('Failed to refresh toys')
      return
    }

    setCoins(prev => (prev !== null ? prev - 5 : 0))
    setResetCount(prev => prev + 1)
    setToast('🦀 FRESH MEAT!!!')
  }

  const handleTurnEnd = () => {
    setPlaying(false)
  }

  const dropTaunts = [
    '😂 Butter fingers!',
    '🫠 Oops... slippery little guy',
    '💀 The claw has spoken',
    '🤡 skill issue tbh',
    '😈 Mine now hehe',
    '🗑️ Back to the pile!',
    '👋 Bye bye toy~',
    '💩 Rigged? Nah you just suck',
    '😭 Cry about it lol',
    '🤏 Almost had it... NOT',
  ]

  const handleDrop = () => {
    const taunt = dropTaunts[Math.floor(Math.random() * dropTaunts.length)]
    setToast(taunt)
  }

  const successMessages = [
    '🙄 Finally, took you long enough',
    '🥱 Wow~~',
    '🎁 Congrats on your participation trophy',
    '🐌 Slowest win I\'ve ever seen',
    '🤷 I let you have that one',
    '😏 Don\'t get used to it',
    '🪫 Running on beginner\'s luck',
    '👶🏻 Pure RRNG, zero skill',
    '👀 BRUH',
  ]

  const handleSuccess = () => {
    const msg = successMessages[Math.floor(Math.random() * successMessages.length)]
    setToast(msg)
  }

  const canPlay = !playing && coins !== null && coins > 0
  const canRefresh = !playing && coins !== null && coins >= 5

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timeout)
  }, [toast])

  return (
    <div className="h-screen bg-base-900 flex flex-col pb-20 relative">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 inset-x-0 mx-auto w-fit z-[70] px-5 py-2.5 bg-base-800/90 backdrop-blur-sm border border-neon-cyan/20 rounded-2xl text-white text-sm font-body shadow-lg max-w-[85vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 pointer-events-none">
        <DotGrid dotSize={6} gap={20} baseColor="#271E37" activeColor="#5227FF" proximity={150} shockRadius={250} shockStrength={4} returnDuration={1.0} />
      </div>
      <div className="max-w-lg mx-auto px-4 pt-6 shrink-0 relative z-10">
        <h1 className="text-neon-cyan text-xs text-center mb-6 font-pixel opacity-0 pointer-events-none">Claw!!!</h1>

        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪙</span>
            <span className="font-pixel text-neon-yellow text-sm">
              {coins !== null ? coins : '...'}
            </span>
          </div>
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            className={`min-h-[44px] px-4 py-2 font-pixel text-xs rounded-xl border transition-colors ${
              canPlay
                ? 'bg-neon-pink/20 border-neon-pink/30 text-neon-pink hover:bg-neon-pink/30'
                : 'bg-base-800 border-base-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {playing ? 'Playing...' : coins && coins > 0 ? 'Play 1' : 'No Coins'}
          </button>
          <button
            onClick={handleRefreshToys}
            disabled={!canRefresh}
            className={`min-h-[44px] px-3 py-2 font-pixel text-xs rounded-xl border transition-colors ${
              canRefresh
                ? 'bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/30'
                : 'bg-base-800 border-base-700 text-gray-500 cursor-not-allowed'
            }`}
            title="Refresh toys for 5 coins"
          >
            Renew 5
          </button>
        </div>
        {message && (
          <p className="text-neon-yellow text-xs text-center mb-1 font-body">{message}</p>
        )}
      </div>

      <div className="flex-1 min-h-0 max-w-lg mx-auto w-full flex items-center justify-center -mt-10 sm:-mt-4">
        <ClawMachine key={seed} playable={playing} onTurnEnd={handleTurnEnd} onDrop={handleDrop} onSuccess={handleSuccess} userId={userId} active={active} seed={seed} />
      </div>

      <BottomNavBar />
    </div>
  )
}
