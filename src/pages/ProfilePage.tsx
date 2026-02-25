import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BottomNavBar } from '../components/BottomNavBar'
import { EmptyState } from '../components/EmptyState'
import DotGrid from '../components/DotGrid'
import ElectricBorder from '../components/ElectricBorder'
import { getProfile, getToyCollection } from '../services/profileService'
// @ts-expect-error — toyCache is a JS module
import { getCachedToys } from '../utils/toyCache'
import type { UserProfile, UserToy } from '../types'

interface ToyInfo {
  w: number
  h: number
  sw: number
  sh: number
  st: number
  sl: number
  sNormal: string
  sGrabbed?: string
  sCollected?: string
  group: string
}

export function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [toys, setToys] = useState<UserToy[]>([])
  const [toyData, setToyData] = useState<Record<string, ToyInfo>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const uid = session.user.id
      getProfile(uid).then(setProfile)
      getToyCollection(uid).then(setToys)
    })
    getCachedToys().then((data: Record<string, ToyInfo> | null) => {
      if (data) setToyData(data)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/signin', { replace: true })
  }

  // Build a map of toyId -> count from user's collection
  const ownedMap = useMemo(() => {
    const m: Record<string, number> = {}
    toys.forEach(t => { m[t.toyId] = t.count })
    return m
  }, [toys])

  // Find the max count for electric border
  const maxCount = useMemo(() => {
    if (toys.length === 0) return 0
    return Math.max(...toys.map(t => t.count))
  }, [toys])

  // Group all toys by group name
  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {}
    Object.entries(toyData).forEach(([name, info]) => {
      const g = info.group || 'Other'
      if (!groups[g]) groups[g] = []
      groups[g].push(name)
    })
    return groups
  }, [toyData])

  // Rare toys: toys in groups with only 1 member
  const rareSet = useMemo(() => {
    const rare = new Set<string>()
    Object.values(grouped).forEach(names => {
      if (names.length === 1) rare.add(names[0])
    })
    return rare
  }, [grouped])

  return (
    <div className="min-h-screen bg-base-900 pb-20 relative">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <DotGrid dotSize={6} gap={20} baseColor="#1a3a4a" activeColor="#22d3ee" proximity={100} shockRadius={200} shockStrength={3} returnDuration={1.2} />
      </div>
      <div className="max-w-lg mx-auto px-4 pt-2 relative z-10">
        <h1 className="text-neon-cyan text-xs text-center mb-2 font-pixel opacity-0 pointer-events-none">Profile</h1>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="p-4 text-center">
            <p className="text-3xl mb-1">✅</p>
            <p className="font-pixel text-neon-green text-sm">
              {profile?.completedTasks ?? '...'}
            </p>
            <p className="text-gray-400 text-xs font-body mt-1">Tasks Done</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-3xl mb-1">🪙</p>
            <p className="font-pixel text-neon-yellow text-sm">
              {profile?.coins ?? '...'}
            </p>
            <p className="text-gray-400 text-xs font-body mt-1">Coins</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-4 text-center hover:bg-base-800 rounded-xl transition-colors"
            aria-label="Logout"
          >
            <p className="text-3xl mb-1">🚪</p>
            <p className="font-pixel text-red-500 text-sm">✕</p>
            <p className="text-gray-400 text-xs font-body mt-1">Logout</p>
          </button>
        </div>

        {/* My Collection */}
        <h2 className="text-neon-pink text-[10px] text-center mb-4 font-pixel">My Collection</h2>

        {toys.length === 0 ? (
          <EmptyState
            emoji="🧸"
            message="No toys yet! Earn coins by completing tasks, then play the claw machine."
          />
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[...toys]
              .sort((a, b) => {
                const aRare = rareSet.has(a.toyId) ? 1 : 0
                const bRare = rareSet.has(b.toyId) ? 1 : 0
                if (aRare !== bRare) return bRare - aRare // rare first
                if (a.count !== b.count) return b.count - a.count // then by count desc
                return a.toyId.localeCompare(b.toyId) // then alphabetically
              })
              .map(ut => {
                const info = toyData[ut.toyId]
                const isMax = maxCount > 0 && ut.count === maxCount
                const isRare = rareSet.has(ut.toyId)
                const card = (
                  <ToyCard
                    key={ut.toyId}
                    name={ut.toyId}
                    sprite={info?.sCollected || info?.sNormal}
                    owned
                    count={ut.count}
                    electric={isMax && !isRare}
                  />
                )
                if (isRare) {
                  return (
                    <ElectricBorder key={ut.toyId} borderRadius={12} color="#7df9ff" speed={1} chaos={0.03}>
                      {card}
                    </ElectricBorder>
                  )
                }
                return card
              })}
          </div>
        )}

        {/* All Toys Catalog */}
        {Object.keys(grouped).length > 0 && (
          <>
            <h2 className="text-neon-pink text-[10px] text-center mb-4 font-pixel">All Toys</h2>
            <div className="space-y-6">
              {Object.entries(grouped).map(([group, toyNames]) => (
                <div key={group}>
                  <p className="text-gray-600 text-[10px] font-pixel mb-2 uppercase tracking-wider">{group}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {toyNames.map(name => {
                      const info = toyData[name]
                      const count = ownedMap[name] || 0
                      const owned = count > 0
                      const isRare = owned && rareSet.has(name)
                      const isMax = owned && maxCount > 0 && count === maxCount

                      const card = (
                        <ToyCard
                          key={name}
                          name={name}
                          sprite={info?.sCollected || info?.sNormal}
                          owned={owned}
                          count={count}
                          electric={isMax && !isRare}
                        />
                      )

                      if (isRare) {
                        return (
                          <ElectricBorder key={name} borderRadius={12} color="#7df9ff" speed={1} chaos={0.03}>
                            {card}
                          </ElectricBorder>
                        )
                      }
                      return card
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNavBar />
    </div>
  )
}

function ToyCard({
  name,
  sprite,
  owned,
  count,
  electric,
}: {
  name: string
  sprite?: string
  owned: boolean
  count: number
  electric: boolean
}) {
  return (
    <div
      className={`relative rounded-xl p-3 flex flex-col items-center text-center transition-all ${
        electric
          ? 'bg-base-800 electric-border'
          : owned
            ? 'bg-base-800 border border-base-700'
            : 'bg-base-800/40 border border-base-700/40'
      }`}
    >
      {sprite ? (
        <img
          src={sprite}
          alt={name}
          className={`w-12 h-12 object-contain mb-2 ${owned ? '' : 'grayscale opacity-30'}`}
        />
      ) : (
        <div className={`w-12 h-12 bg-base-700 rounded mb-2 flex items-center justify-center text-2xl ${owned ? '' : 'opacity-30'}`}>
          🧸
        </div>
      )}
      <p className={`text-[10px] font-body truncate w-full ${owned ? 'text-gray-300' : 'text-gray-600'}`}>
        {name}
      </p>
      {owned && (
        <p className="text-[9px] text-neon-cyan mt-0.5">×{count}</p>
      )}
    </div>
  )
}
