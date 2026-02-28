/**
 * Voice Store
 *
 * Manages voice/video connection state. This is a singleton store because
 * only one voice connection can be active at a time across all instances.
 *
 * The instanceId field tracks which Redoubt instance currently has the
 * active voice connection.
 *
 * Note: Device settings and input mode are persisted in settingsStore.
 * This store only manages runtime connection state.
 */

import { create } from 'zustand'
import { Room, ConnectionState } from 'livekit-client'
import { useSettingsStore } from './settingsStore'

type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown'

interface VoiceState {
  // Instance tracking - which instance has the active voice connection
  instanceId: string | null

  // Connection state
  room: Room | null
  connectionState: ConnectionState
  currentChannelId: string | null

  // Local state (runtime only)
  isMuted: boolean
  isDeafened: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  isPttActive: boolean

  // Quality
  connectionQuality: ConnectionQuality

  // Actions
  setInstanceId: (instanceId: string | null) => void
  setRoom: (room: Room | null) => void
  setConnectionState: (state: ConnectionState) => void
  setCurrentChannel: (channelId: string | null) => void
  toggleMute: () => void
  toggleDeafen: () => void
  toggleVideo: () => void
  toggleScreenShare: () => Promise<void>
  setPttActive: (active: boolean) => void
  setConnectionQuality: (quality: ConnectionQuality) => void
  reset: () => void

  // Helpers
  isVoiceActiveOnInstance: (instanceId: string) => boolean
  getVoiceInstanceId: () => string | null
}

const initialState = {
  instanceId: null,
  room: null,
  connectionState: ConnectionState.Disconnected,
  currentChannelId: null,
  isMuted: false,
  isDeafened: false,
  isVideoEnabled: false,
  isScreenSharing: false,
  isPttActive: false,
  connectionQuality: 'unknown' as ConnectionQuality,
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  ...initialState,

  setInstanceId: (instanceId) => set({ instanceId }),
  setRoom: (room) => set({ room }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setCurrentChannel: (currentChannelId) => set({ currentChannelId }),

  toggleMute: () => {
    const { room, isMuted, isDeafened } = get()
    if (!room || isDeafened) return

    const newMuted = !isMuted
    room.localParticipant.setMicrophoneEnabled(!newMuted)
    set({ isMuted: newMuted })
  },

  toggleDeafen: () => {
    const { room, isDeafened, isMuted } = get()
    if (!room) return

    const newDeafened = !isDeafened

    // Deafen also mutes
    if (newDeafened && !isMuted) {
      room.localParticipant.setMicrophoneEnabled(false)
    }

    // Undeafen restores previous mute state
    if (!newDeafened && !isMuted) {
      room.localParticipant.setMicrophoneEnabled(true)
    }

    // Toggle audio subscription for all remote participants
    // Note: Deafening is handled by muting audio elements at the UI level
    // or by unsubscribing from audio tracks
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        // Toggle subscription based on deafen state
        pub.setSubscribed(!newDeafened)
      })
    })

    set({ isDeafened: newDeafened, isMuted: newDeafened || isMuted })
  },

  toggleVideo: () => {
    const { room, isVideoEnabled } = get()
    if (!room) return

    const newEnabled = !isVideoEnabled
    room.localParticipant.setCameraEnabled(newEnabled)
    set({ isVideoEnabled: newEnabled })
  },

  toggleScreenShare: async () => {
    const { room, isScreenSharing } = get()
    if (!room) return

    // Check for getDisplayMedia availability (requires secure context)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      console.warn(
        'Screen sharing not available. This feature requires a secure context (HTTPS or localhost).'
      )
      return
    }

    const newSharing = !isScreenSharing
    await room.localParticipant.setScreenShareEnabled(newSharing)
    set({ isScreenSharing: newSharing })
  },

  setPttActive: (isPttActive) => {
    const { room, isDeafened } = get()
    const inputMode = useSettingsStore.getState().inputMode
    if (!room || inputMode !== 'ptt' || isDeafened) return

    room.localParticipant.setMicrophoneEnabled(isPttActive)
    set({ isPttActive, isMuted: !isPttActive })
  },

  setConnectionQuality: (connectionQuality) => set({ connectionQuality }),

  reset: () => set(initialState),

  isVoiceActiveOnInstance: (instanceId) => {
    const state = get()
    return (
      state.instanceId === instanceId &&
      state.connectionState === ConnectionState.Connected
    )
  },

  getVoiceInstanceId: () => get().instanceId,
}))
