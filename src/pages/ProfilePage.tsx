import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BottomNavBar } from '../components/BottomNavBar'
import { EmptyState } from '../components/EmptyState'
import { getProfile, getToyCollection } from '../services/profileService'
import type { UserProfile, UserToy } from '../types'

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [toys, setToys] = useState<UserToy[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const uid = session.user.id
      getProfile(uid).then(setProfile)
      getToyCollection(uid).then(setToys)
    })
  }, [])

  return (
    <div className="min-h-screen bg-base-900 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-neon-cyan text-xs text-center mb-6">Profile</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-base-800 rounded-xl border border-base-700 p-4 text-center">
            <p className="text-3xl mb-1">✅</p>
            <p className="font-pixel text-neon-green text-sm">
              {profile?.completedTasks ?? '...'}
            </p>
            <p className="text-gray-400 text-xs font-body mt-1">Tasks Done</p>
          </div>
          <div className="bg-base-800 rounded-xl border border-base-700 p-4 text-center">
            <p className="text-3xl mb-1">🪙</p>
            <p className="font-pixel text-neon-yellow text-sm">
              {profile?.coins ?? '...'}
            </p>
            <p className="text-gray-400 text-xs font-body mt-1">Coins</p>
          </div>
        </div>

        {/* Toy Collection */}
        <h2 className="text-neon-pink text-[10px] text-center mb-4">Toy Collection</h2>

        {toys.length === 0 ? (
          <EmptyState
            emoji="🧸"
            message="No toys yet! Earn coins by completing tasks, then play the claw machine."
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {toys.map(ut => (
              <div
                key={ut.id}
                className="bg-base-800 rounded-xl border border-base-700 p-3 flex flex-col items-center text-center"
              >
                {ut.toy?.spriteCollected ? (
                  <img
                    src={`data:${ut.toy.mimeType || 'image/png'};base64,${ut.toy.spriteCollected}`}
                    alt={ut.toy.name}
                    className="w-12 h-12 object-contain mb-2"
                  />
                ) : (
                  <div className="w-12 h-12 bg-base-700 rounded mb-2 flex items-center justify-center text-2xl">
                    🧸
                  </div>
                )}
                <p className="text-[10px] text-gray-300 font-body truncate w-full">
                  {ut.toy?.name ?? 'Unknown'}
                </p>
                {ut.count > 1 && (
                  <p className="text-[9px] text-neon-cyan mt-0.5">×{ut.count}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNavBar />
    </div>
  )
}
