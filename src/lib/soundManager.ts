import { useSettingsStore } from '@/store/settingsStore'

type SoundType = 'join' | 'leave'

const SOUND_FILES: Record<SoundType, string> = {
  join: '/sounds/join.mp3',
  leave: '/sounds/leave.mp3',
}

class SoundManager {
  private audioElements: Map<SoundType, HTMLAudioElement> = new Map()

  constructor() {
    // Preload all sounds
    for (const [type, url] of Object.entries(SOUND_FILES)) {
      const audio = new Audio(url)
      audio.preload = 'auto'
      this.audioElements.set(type as SoundType, audio)
    }
  }

  play(type: SoundType): void {
    // Get settings from persisted store
    const { soundEffectsEnabled, soundEffectsVolume, audioOutputDevice } = useSettingsStore.getState()

    if (!soundEffectsEnabled) return

    const audio = this.audioElements.get(type)
    if (!audio) return

    // Clone and play to allow overlapping sounds
    const clone = audio.cloneNode() as HTMLAudioElement
    clone.volume = soundEffectsVolume

    if (audioOutputDevice && 'setSinkId' in clone) {
      const audioWithSinkId = clone as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }
      audioWithSinkId.setSinkId(audioOutputDevice).then(() => {
        clone.play().catch(console.error)
      }).catch(console.error)
    } else {
      clone.play().catch(console.error)
    }
  }
}

export const soundManager = new SoundManager()
export type { SoundType }
