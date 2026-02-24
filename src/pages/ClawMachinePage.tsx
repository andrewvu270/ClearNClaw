import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BottomNavBar } from '../components/BottomNavBar'
import * as coinService from '../services/coinService'
// @ts-expect-error — ClawMachine is a JSX component without types
import ClawMachine from '../components/ClawMachine'

export function ClawMachinePage() {
  const [coins, setCoins] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        coinService.getCoinBalance(session.user.id).then(setCoins)
      }
    })
  }, [])

  const handlePlay = async () => {
    if (!userId || coins === null || coins <= 0) {
      setMessage('No coins! Complete tasks to earn more.')
      return
    }

    const success = await coinService.spendCoin(userId)
    if (!success) {
      setMessage('No coins! Complete tasks to earn more.')
      return
    }

    setCoins(prev => (prev !== null ? prev - 1 : 0))
    setMessage('')
    setPlaying(true)
  }

  return (
    <div className="min-h-screen bg-base-900 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-neon-cyan text-xs text-center mb-4">Claw Machine</h1>

        {/* Coin balance */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-2xl">🪙</span>
          <span className="font-pixel text-neon-yellow text-sm">
            {coins !== null ? coins : '...'}
          </span>
        </div>

        {!playing ? (
          <div className="text-center">
            <button
              onClick={handlePlay}
              disabled={coins === 0}
              className={`min-h-[44px] px-8 py-3 font-pixel text-sm rounded-xl border transition-colors ${
                coins && coins > 0
                  ? 'bg-neon-pink/20 border-neon-pink/30 text-neon-pink hover:bg-neon-pink/30'
                  : 'bg-base-800 border-base-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {coins && coins > 0 ? 'Play (1 Coin)' : 'No Coins'}
            </button>
            {message && (
              <p className="text-neon-yellow text-xs mt-3 font-body">{message}</p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <ClawMachine />
          </div>
        )}
      </div>

      <BottomNavBar />
    </div>
  )
}
