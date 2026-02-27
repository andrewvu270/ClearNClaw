import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { BottomNavBar } from '../components/BottomNavBar'
import { EmptyState } from '../components/EmptyState'
import DotGrid from '../components/DotGrid'
import ElectricBorder from '../components/ElectricBorder'
import TiltedCard from '../components/TiltedCard'
import { getProfile, getToyCollection } from '../services/profileService'
import { useStimMode } from '../contexts/StimModeContext'
import {
  isPushSupported,
  subscribePush,
  unsubscribePush,
  updatePushFrequency,
  syncPushState,
} from '../services/pushService'
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
  const { isLowStim, toggle } = useStimMode()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [toys, setToys] = useState<UserToy[]>([])
  const [toyData, setToyData] = useState<Record<string, ToyInfo>>({})
  const [selectedToy, setSelectedToy] = useState<{ name: string; count: number; sprite?: string; isRare?: boolean; isElectric?: boolean; group?: string } | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [pushSupported, setPushSupported] = useState(() => isPushSupported())
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushFrequency, setPushFrequency] = useState<string | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Re-check push support when settings opens (iOS may enable it after PWA install)
  useEffect(() => {
    if (settingsOpen) {
      setPushSupported(isPushSupported())
    }
  }, [settingsOpen])

  // Lock body scroll when popup is open
  useEffect(() => {
    if (selectedToy || settingsOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [selectedToy, settingsOpen])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const uid = session.user.id
      setUserId(uid)
      Promise.all([
        getProfile(uid).then(setProfile),
        getToyCollection(uid).then(setToys),
        syncPushState(uid).then(({ enabled, frequency }) => {
          setPushEnabled(enabled)
          setPushFrequency(frequency)
        }),
      ]).then(() => setDataLoaded(true))
    })
    getCachedToys().then((data: Record<string, ToyInfo> | null) => {
      if (data) setToyData(data)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/signin', { replace: true })
  }

  const handlePushToggle = async () => {
    if (!userId) return
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribePush(userId)
        setPushEnabled(false)
        setPushFrequency(null)
      } else {
        const success = await subscribePush(userId)
        if (success) {
          setPushEnabled(true)
          setPushFrequency('hourly')
          await updatePushFrequency(userId, 'hourly')
        }
      }
    } catch (err) {
      console.error('Push toggle error:', err)
    } finally {
      setPushLoading(false)
    }
  }

  const handleFrequencyChange = async (freq: 'hourly' | '2hours' | '3daily' | 'daily' | null) => {
    if (!userId) return
    setPushFrequency(freq)
    if (freq) {
      await updatePushFrequency(userId, freq)
    } else {
      await supabase.from('profiles').update({ push_frequency: null }).eq('id', userId)
    }
  }

  // Build a map of toyId -> count from user's collection
  const ownedMap = useMemo(() => {
    const m: Record<string, number> = {}
    toys.forEach(t => { m[t.toyId] = t.count })
    return m
  }, [toys])

  // Find the max count for electric border (only if > 1, so initial count of 1 doesn't get border)
  const maxCount = useMemo(() => {
    if (toys.length === 0) return 0
    const max = Math.max(...toys.map(t => t.count))
    return max > 1 ? max : 0
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
      <div className="absolute inset-0 pointer-events-none">
        <DotGrid dotSize={6} gap={20} baseColor="#271E37" activeColor="#5227FF" proximity={150} shockRadius={250} shockStrength={4} returnDuration={1.0} />
      </div>
      <div className="max-w-lg mx-auto px-4 pt-6 relative z-10">
        <h1 className="text-neon-cyan text-xs text-center mb-6 font-pixel opacity-0 pointer-events-none">Profile</h1>

        {/* Stats */}
        {dataLoaded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl">✅</span>
            <span className="font-pixel text-neon-green text-sm">
              {profile?.completedTasks ?? '...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl">🪙</span>
            <span className="font-pixel text-neon-yellow text-sm">
              {profile?.coins ?? '...'}
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 hover:bg-base-800 rounded-xl px-2 py-1 transition-colors"
            aria-label="Open Settings"
          >
            <span className="text-2xl">⚙️</span>
            <span className="font-pixel text-gray-500 text-sm">Settings</span>
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
                const handleTap = () => setSelectedToy({ name: ut.toyId, count: ut.count, sprite: info?.sCollected || info?.sNormal, isRare, isElectric: isMax && !isRare, group: info?.group || 'Other' })
                const card = (
                  <ToyCard
                    key={ut.toyId}
                    name={ut.toyId}
                    sprite={info?.sCollected || info?.sNormal}
                    owned
                    count={ut.count}
                    electric={isMax && !isRare}
                    onTap={handleTap}
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
                      const handleTap = () => owned && setSelectedToy({ name, count, sprite: info?.sCollected || info?.sNormal, isRare, isElectric: isMax && !isRare, group: info?.group || 'Other' })

                      const card = (
                        <ToyCard
                          key={name}
                          name={name}
                          sprite={info?.sCollected || info?.sNormal}
                          owned={owned}
                          count={count}
                          electric={isMax && !isRare}
                          onTap={handleTap}
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
          </motion.div>
        ) : (
          <div className="flex justify-center pt-16">
            <span className="text-gray-600 text-xs animate-pulse">Loading...</span>
          </div>
        )}
      </div>

      {/* Toy detail popup */}
      <AnimatePresence>
        {selectedToy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
            onClick={() => setSelectedToy(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
            >
              <TiltedCard containerHeight="auto" containerWidth="100%" rotateAmplitude={8} scaleOnHover={1.03}>
                {selectedToy.isRare ? (
                  <ElectricBorder borderRadius={16} color="#7df9ff" speed={1} chaos={0.03}>
                    <ToyPopupContent toy={selectedToy} />
                  </ElectricBorder>
                ) : selectedToy.isElectric ? (
                  <div className="rounded-2xl p-[2px]" style={{ background: 'linear-gradient(135deg, #00e5ff, #7c3aed, #ec4899, #00e5ff)', transformStyle: 'preserve-3d' }}>
                    <ToyPopupContent toy={selectedToy} />
                  </div>
                ) : (
                  <ToyPopupContent toy={selectedToy} />
                )}
              </TiltedCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={() => setSettingsOpen(false)}
            />
            <motion.div
              key="settings-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100) setSettingsOpen(false)
              }}
              className="fixed inset-0 z-[60] flex flex-col bg-base-900"
            >
              {/* Content */}
              <div className="flex-1 overflow-y-auto pb-8">
                <div className="max-w-lg mx-auto px-4 pt-6">
                  {/* Back button */}
                  <div className="flex items-center justify-between mb-1">
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="min-w-[60px] min-h-[60px] flex items-center justify-center text-gray-400 hover:text-white transition-colors text-4xl font-pixel"
                      aria-label="Back"
                    >
                      ←
                    </button>
                  </div>
                  <h2 className="text-lg font-pixel text-gray-200 text-center mb-4">Settings</h2>
                </div>
                <div className="max-w-lg mx-auto px-6 space-y-4">
                  {/* Low Stim Mode */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎚️</span>
                      <span className="text-gray-200 font-medium">Low Stim Mode</span>
                    </div>
                    <button
                      onClick={toggle}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        isLowStim ? 'bg-neon-cyan' : 'bg-gray-600'
                      }`}
                      role="switch"
                      aria-checked={isLowStim}
                      aria-label="Toggle Low Stimulation Mode"
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                          isLowStim ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Push Notifications */}
                  {pushSupported && (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔔</span>
                          <span className="text-gray-200 font-medium">Push Notifications</span>
                        </div>
                        <button
                          onClick={handlePushToggle}
                          disabled={pushLoading}
                          className={`relative w-12 h-7 rounded-full transition-colors ${
                            pushEnabled ? 'bg-neon-cyan' : 'bg-gray-600'
                          } ${pushLoading ? 'opacity-50' : ''}`}
                          role="switch"
                          aria-checked={pushEnabled}
                          aria-label="Toggle push notifications"
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                              pushEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      {pushEnabled && (
                        <>
                          <p className="text-gray-500 text-xs mt-2 ml-8">Task reminders will be delivered as push notifications.</p>

                          {/* Nudge sub-toggle */}
                          <div className="flex items-center justify-between mt-4 ml-8">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📢</span>
                              <span className="text-gray-200 font-medium text-sm">Periodic Nudges</span>
                            </div>
                            <button
                              onClick={() => {
                                if (pushFrequency) {
                                  handleFrequencyChange(null)
                                } else {
                                  handleFrequencyChange('hourly')
                                }
                              }}
                              className={`relative w-12 h-7 rounded-full transition-colors ${
                                pushFrequency ? 'bg-neon-cyan' : 'bg-gray-600'
                              }`}
                              role="switch"
                              aria-checked={!!pushFrequency}
                              aria-label="Toggle periodic nudges"
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                                  pushFrequency ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                          {pushFrequency && (
                            <div className="flex gap-2 flex-wrap mt-3 ml-16">
                              {([
                                { value: 'hourly', label: 'Every hour' },
                                { value: '2hours', label: 'Every 2h' },
                                { value: '3daily', label: '3×/day' },
                                { value: 'daily', label: 'Once/day' },
                              ] as const).map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleFrequencyChange(opt.value)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-body transition-colors ${
                                    pushFrequency === opt.value
                                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                                      : 'bg-base-700 text-gray-400 border border-base-700 hover:bg-base-700/80'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <hr className="border-gray-700" />

                  {/* Logout */}
                  <div className="pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full px-6 py-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <span>🚪</span>
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
  onTap,
}: {
  name: string
  sprite?: string
  owned: boolean
  count: number
  electric: boolean
  onTap?: () => void
}) {
  return (
    <div
      role={owned ? 'button' : undefined}
      tabIndex={owned ? 0 : undefined}
      onClick={() => owned && onTap?.()}
      onKeyDown={e => { if (owned && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTap?.() } }}
      className={`relative rounded-xl p-3 flex flex-col items-center text-center transition-all ${
        owned ? 'cursor-pointer active:scale-95' : ''
      } ${
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

function ToyPopupContent({ toy }: { toy: { name: string; count: number; sprite?: string; group?: string } }) {
  return (
    <div className="relative bg-base-800 border border-base-700 rounded-2xl p-8 max-w-sm w-full text-center" style={{ transformStyle: 'preserve-3d' }}>
      {/* Holographic shimmer overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          transform: 'translateZ(4px)',
          background: `radial-gradient(circle at var(--pointer-x, 50%) var(--pointer-y, 50%), rgba(0,229,255,0.18) 0%, rgba(168,85,247,0.14) 25%, rgba(236,72,153,0.12) 50%, rgba(34,211,238,0.08) 75%, transparent 100%)`,
        }}
      />
      {/* Sprite — highest depth */}
      {toy.sprite ? (
        <img
          src={toy.sprite}
          alt={toy.name}
          className="w-40 h-40 object-contain mx-auto mb-5 drop-shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          style={{ transform: 'translateZ(100px)' }}
        />
      ) : (
        <div className="w-40 h-40 bg-base-700 rounded-xl mx-auto mb-5 flex items-center justify-center text-6xl" style={{ transform: 'translateZ(100px)' }}>🧸</div>
      )}
      {/* Name + count — mid depth */}
      <p className="text-white font-body text-base mb-1" style={{ transform: 'translateZ(60px)' }}>{toy.name}</p>
      <p className="text-neon-cyan font-pixel text-sm mb-2" style={{ transform: 'translateZ(60px)' }}>×{toy.count} collected</p>
      {/* Group — lower depth */}
      <p className="text-neon-pink/70 font-pixel text-[10px] uppercase tracking-wider" style={{ transform: 'translateZ(40px)' }}>{toy.group || 'Other'}</p>
    </div>
  )
}
