import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'cyan' | 'rose'
export type InputMode = 'vad' | 'ptt'

export const ACCENT_COLORS: { name: string; value: AccentColor; preview: string }[] = [
  { name: 'Blue', value: 'blue', preview: 'hsl(220, 100%, 60%)' },
  { name: 'Purple', value: 'purple', preview: 'hsl(270, 100%, 60%)' },
  { name: 'Green', value: 'green', preview: 'hsl(142, 100%, 60%)' },
  { name: 'Orange', value: 'orange', preview: 'hsl(24, 100%, 60%)' },
  { name: 'Cyan', value: 'cyan', preview: 'hsl(185, 100%, 60%)' },
  { name: 'Rose', value: 'rose', preview: 'hsl(350, 100%, 60%)' },
]

interface SettingsState {
  // Appearance
  accentColor: AccentColor
  setAccentColor: (color: AccentColor) => void

  // Audio/Video devices
  audioInputDevice: string | null
  audioOutputDevice: string | null
  videoInputDevice: string | null
  setAudioInputDevice: (deviceId: string | null) => void
  setAudioOutputDevice: (deviceId: string | null) => void
  setVideoInputDevice: (deviceId: string | null) => void

  // Voice settings
  inputMode: InputMode
  setInputMode: (mode: InputMode) => void

  // Sound effects
  soundEffectsEnabled: boolean
  soundEffectsVolume: number
  setSoundEffectsEnabled: (enabled: boolean) => void
  setSoundEffectsVolume: (volume: number) => void
}

// Apply accent color to document
function applyAccentColor(color: AccentColor) {
  document.documentElement.setAttribute('data-accent', color)
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Appearance
      accentColor: 'blue',
      setAccentColor: (color) => {
        applyAccentColor(color)
        set({ accentColor: color })
      },

      // Audio/Video devices
      audioInputDevice: null,
      audioOutputDevice: null,
      videoInputDevice: null,
      setAudioInputDevice: (deviceId) => set({ audioInputDevice: deviceId }),
      setAudioOutputDevice: (deviceId) => set({ audioOutputDevice: deviceId }),
      setVideoInputDevice: (deviceId) => set({ videoInputDevice: deviceId }),

      // Voice settings
      inputMode: 'vad',
      setInputMode: (mode) => set({ inputMode: mode }),

      // Sound effects
      soundEffectsEnabled: true,
      soundEffectsVolume: 0.5,
      setSoundEffectsEnabled: (enabled) => set({ soundEffectsEnabled: enabled }),
      setSoundEffectsVolume: (volume) => set({ soundEffectsVolume: volume }),
    }),
    {
      name: 'redoubt-settings',
      onRehydrateStorage: () => (state) => {
        // Apply the saved accent color on rehydration
        if (state) {
          applyAccentColor(state.accentColor)
        }
      },
    }
  )
)
