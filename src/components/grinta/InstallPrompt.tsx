'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'grinta-install-dismissed'

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already installed or already dismissed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      sessionStorage.getItem(DISMISSED_KEY)
    ) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-4 flex items-center gap-3 animate-slide-up"
      style={{
        background: '#111',
        border: '1px solid rgba(170,255,0,0.25)',
        boxShadow: '0 0 24px rgba(170,255,0,0.08)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(170,255,0,0.12)', border: '1px solid rgba(170,255,0,0.2)' }}
      >
        <Download className="w-5 h-5" style={{ color: 'var(--lime)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm text-white">Installer Grinta</p>
        <p className="text-[11px] text-[#666] mt-0.5">Accès rapide depuis ton écran d'accueil</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider"
          style={{ background: 'rgba(170,255,0,0.15)', border: '1px solid rgba(170,255,0,0.3)', color: 'var(--lime)' }}
        >
          INSTALLER
        </button>
        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}
        >
          <X className="w-3.5 h-3.5 text-[#555]" />
        </button>
      </div>
    </div>
  )
}
