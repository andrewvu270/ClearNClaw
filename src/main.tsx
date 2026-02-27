import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Register service worker with auto-update, fallback to prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // Try auto-update first
    updateSW(true)

    // If still here after 3 seconds, auto-update didn't work - prompt user
    setTimeout(() => {
      if (confirm('New version available! Reload to update?')) {
        window.location.reload()
      }
    }, 3000)
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
