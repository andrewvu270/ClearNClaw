import { BottomNavBar } from '../components/BottomNavBar'

export function AssistantPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#050c19] text-white pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-pixel text-neon-cyan mb-4">Assistant</h1>
        <p className="text-gray-400">Chat and voice assistant coming soon...</p>
      </div>
      <BottomNavBar />
    </div>
  )
}
