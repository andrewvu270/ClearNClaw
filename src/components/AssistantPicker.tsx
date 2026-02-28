import { motion } from 'framer-motion'
import { ASSISTANT_CHARACTERS } from '../services/assistantPrompt'

type AssistantMode = 'chat' | 'voice'

interface AssistantPickerProps {
  onSelect: (mode: AssistantMode) => void
  voiceDisabled?: boolean
  voiceDisabledReason?: string
  chatDisabled?: boolean
  chatDisabledReason?: string
}

/**
 * AssistantPicker - Character selection screen showing Clea (chat) and Klaw (voice)
 * Users tap a character to start interacting with that assistant
 */
export function AssistantPicker({
  onSelect,
  voiceDisabled,
  voiceDisabledReason,
  chatDisabled,
  chatDisabledReason,
}: AssistantPickerProps) {
  const clea = ASSISTANT_CHARACTERS.clea
  const klaw = ASSISTANT_CHARACTERS.klaw

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 py-6 -mt-16">
      <h2 className="text-white text-lg font-medium mb-2 text-center">
        Choose your assistant
      </h2>
      <p className="text-gray-500 text-xs mb-6 text-center">Same tasks, different vibes</p>

      <div className="flex gap-4 w-full max-w-sm justify-center">
        {/* Clea - Chat */}
        <motion.button
          whileHover={chatDisabled ? {} : { scale: 1.02 }}
          whileTap={chatDisabled ? {} : { scale: 0.98 }}
          onClick={() => !chatDisabled && onSelect('chat')}
          disabled={chatDisabled}
          className={`flex-1 max-w-[160px] bg-base-800 border border-base-700 rounded-2xl p-4 text-center transition-colors group flex flex-col ${
            chatDisabled
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:border-neon-cyan/30'
          }`}
        >
          <div className="w-20 h-20 mx-auto mb-3 mt-4">
            <img
              src={clea.image}
              alt={clea.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="mt-auto">
            <p className="text-white font-medium text-sm mb-1">{clea.name}</p>
            <p className="text-gray-500 text-[11px] mb-2 leading-tight">{clea.description}</p>
            <div
              className={`flex items-center justify-center gap-1.5 text-xs ${
                chatDisabled ? 'text-gray-500' : 'text-neon-cyan'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 0 0 1.33 0l1.713-3.293c.121-.233.362-.393.642-.413 1.198-.087 2.382-.226 3.55-.414 1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{chatDisabled ? chatDisabledReason || 'Unavailable' : 'Chat'}</span>
            </div>
          </div>
        </motion.button>

        {/* Klaw - Voice */}
        <motion.button
          whileHover={voiceDisabled ? {} : { scale: 1.02 }}
          whileTap={voiceDisabled ? {} : { scale: 0.98 }}
          onClick={() => !voiceDisabled && onSelect('voice')}
          disabled={voiceDisabled}
          className={`flex-1 max-w-[160px] bg-base-800 border border-base-700 rounded-2xl p-4 text-center transition-colors group flex flex-col ${
            voiceDisabled
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:border-neon-pink/30'
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-3 mt-4">
            <img
              src={klaw.image}
              alt={klaw.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="mt-auto">
            <p className="text-white font-medium text-sm mb-1">{klaw.name}</p>
            <p className="text-gray-500 text-[11px] mb-2 leading-tight">{klaw.description}</p>
            <div
              className={`flex items-center justify-center gap-1.5 text-xs ${
                voiceDisabled ? 'text-gray-500' : 'text-neon-pink'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
                <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
              </svg>
              <span>
                {voiceDisabled ? voiceDisabledReason || 'Coming soon' : 'Call'}
              </span>
            </div>
          </div>
        </motion.button>
      </div>

      <p className="text-gray-600 text-[11px] mt-6 text-center max-w-[260px]">
        Both assistants can manage your tasks, timers, and reminders
      </p>
    </div>
  )
}
