import { useEffect, useCallback, useRef } from 'react'
import { useVoiceStore } from '@/store/voiceStore'

// Default keybindings
const DEFAULT_PTT_KEY = 'Alt+`'
const DEFAULT_MUTE_KEY = 'Alt+M'
const DEFAULT_DEAFEN_KEY = 'Alt+D'

// Check if running in Tauri
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

interface ShortcutConfig {
  pttKey?: string
  muteKey?: string
  deafenKey?: string
}

export function useGlobalShortcuts(config: ShortcutConfig = {}) {
  const { toggleMute, toggleDeafen, setPttActive, currentChannelId } =
    useVoiceStore()

  const pttKey = config.pttKey || DEFAULT_PTT_KEY
  const muteKey = config.muteKey || DEFAULT_MUTE_KEY
  const deafenKey = config.deafenKey || DEFAULT_DEAFEN_KEY

  // Store cleanup functions
  const cleanupRef = useRef<(() => void)[]>([])

  // Register shortcuts when in a voice channel
  const registerShortcuts = useCallback(async () => {
    if (!isTauri()) return

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('register_ptt_shortcut', { shortcut: pttKey })
      await invoke('register_mute_shortcut', { shortcut: muteKey })
      await invoke('register_deafen_shortcut', { shortcut: deafenKey })
      console.log('Global shortcuts registered')
    } catch (err) {
      console.error('Failed to register shortcuts:', err)
    }
  }, [pttKey, muteKey, deafenKey])

  // Unregister all shortcuts
  const unregisterShortcuts = useCallback(async () => {
    if (!isTauri()) return

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('unregister_all_shortcuts')
      console.log('Global shortcuts unregistered')
    } catch (err) {
      console.error('Failed to unregister shortcuts:', err)
    }
  }, [])

  // Listen for shortcut events and update voice state
  useEffect(() => {
    // Only register shortcuts when in a voice channel and in Tauri
    if (!currentChannelId || !isTauri()) {
      return
    }

    const setupListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')

        // Register the shortcuts
        await registerShortcuts()

        // Listen for PTT press/release
        const unlistenPttPressed = await listen('ptt-pressed', () => {
          setPttActive(true)
        })
        cleanupRef.current.push(unlistenPttPressed)

        const unlistenPttReleased = await listen('ptt-released', () => {
          setPttActive(false)
        })
        cleanupRef.current.push(unlistenPttReleased)

        // Listen for mute toggle
        const unlistenMute = await listen('toggle-mute', () => {
          toggleMute()
        })
        cleanupRef.current.push(unlistenMute)

        // Listen for deafen toggle
        const unlistenDeafen = await listen('toggle-deafen', () => {
          toggleDeafen()
        })
        cleanupRef.current.push(unlistenDeafen)
      } catch (err) {
        console.error('Failed to setup shortcut listeners:', err)
      }
    }

    setupListeners()

    return () => {
      // Cleanup listeners
      cleanupRef.current.forEach((unlisten) => unlisten())
      cleanupRef.current = []
      // Unregister shortcuts
      unregisterShortcuts()
    }
  }, [
    currentChannelId,
    registerShortcuts,
    unregisterShortcuts,
    setPttActive,
    toggleMute,
    toggleDeafen,
  ])

  return {
    registerShortcuts,
    unregisterShortcuts,
  }
}
