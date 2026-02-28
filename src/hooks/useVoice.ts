import { useCallback, useEffect, useRef } from 'react'
import {
  Room,
  RoomEvent,
  ConnectionState,
  ConnectionQuality,
  Participant,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
} from 'livekit-client'
import { useVoiceStore } from '@/store/voiceStore'
import { useInstanceStore } from '@/store/instanceStore'
import { useSettingsStore } from '@/store/settingsStore'
import { authStores } from '@/store/authStore'
import { presenceStores } from '@/store/presenceStore'
import { getApiClient } from '@/lib/api'
import { soundManager } from '@/lib/soundManager'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'

export function useVoice() {
  const roomRef = useRef<Room | null>(null)

  // Get active instance for multi-instance support
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)

  const {
    room,
    connectionState,
    currentChannelId,
    isMuted,
    isDeafened,
    isVideoEnabled,
    isScreenSharing,
    instanceId: voiceInstanceId,
    setRoom,
    setConnectionState,
    setCurrentChannel,
    setConnectionQuality,
    setInstanceId: setVoiceInstanceId,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    reset,
  } = useVoiceStore()

  // Get persisted settings
  const {
    inputMode,
    audioInputDevice,
    audioOutputDevice,
  } = useSettingsStore()

  const mapConnectionQuality = useCallback(
    (quality: ConnectionQuality): 'excellent' | 'good' | 'poor' | 'unknown' => {
      switch (quality) {
        case ConnectionQuality.Excellent:
          return 'excellent'
        case ConnectionQuality.Good:
          return 'good'
        case ConnectionQuality.Poor:
        case ConnectionQuality.Lost:
          return 'poor'
        default:
          return 'unknown'
      }
    },
    []
  )

  const setupRoomListeners = useCallback(
    (room: Room, instanceId: string) => {
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state)
      })

      room.on(
        RoomEvent.ConnectionQualityChanged,
        (quality: ConnectionQuality, participant: Participant) => {
          // Only track local participant quality
          if (participant === room.localParticipant) {
            setConnectionQuality(mapConnectionQuality(quality))
          }
        }
      )

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState(ConnectionState.Disconnected)
        setCurrentChannel(null)
      })

      room.on(RoomEvent.Reconnecting, () => {
        setConnectionState(ConnectionState.Reconnecting)
      })

      room.on(RoomEvent.Reconnected, () => {
        setConnectionState(ConnectionState.Connected)
      })

      // Handle remote audio track subscription - attach to audio element for playback
      room.on(
        RoomEvent.TrackSubscribed,
        (track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            // Attach audio track to a new audio element for playback
            const audioElement = track.attach()
            audioElement.id = `audio-${participant.identity}`
            document.body.appendChild(audioElement)
            console.log(`Audio track attached for participant: ${participant.identity}`)
          }
        }
      )

      // Clean up audio elements when tracks are unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            // Detach and remove the audio element
            track.detach().forEach((el) => el.remove())
            // Also try to remove by ID in case detach didn't get it
            const audioEl = document.getElementById(`audio-${participant.identity}`)
            if (audioEl) {
              audioEl.remove()
            }
            console.log(`Audio track detached for participant: ${participant.identity}`)
          }
        }
      )

      // Track active speakers for all participants (including local)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const presenceStore = presenceStores.get(instanceId)
        const currentUser = authStores.get(instanceId).getState().user
        const speakerIds = new Set(speakers.map((s) => s.identity))

        // Update speaking state for remote participants
        for (const participant of room.remoteParticipants.values()) {
          const isSpeaking = speakerIds.has(participant.identity)
          presenceStore.getState().setVoiceState(participant.identity, undefined, {
            speaking: isSpeaking,
          })
        }

        // Update speaking state for local participant
        if (currentUser) {
          const localSpeaking = speakerIds.has(room.localParticipant.identity)
          presenceStore.getState().setVoiceState(currentUser.id, undefined, {
            speaking: localSpeaking,
          })
        }
      })
    },
    [setConnectionState, setConnectionQuality, setCurrentChannel, mapConnectionQuality]
  )

  const joinChannel = useCallback(
    async (channelId: string) => {
      if (!activeInstanceId) {
        throw new Error('No active instance')
      }

      // Leave current channel if in one (including if on different instance)
      if (currentChannelId) {
        await leaveChannel()
      }

      const targetInstanceId = activeInstanceId

      try {
        // Check for secure context (required for getUserMedia)
        if (!window.isSecureContext) {
          console.warn('Not in a secure context - voice features may not work. Use localhost or HTTPS.')
        }

        // Get token from API
        const instanceApi = getApiClient(activeInstanceId)
        const response = await instanceApi.joinVoiceChannel(channelId)

        // Create room with device settings configured upfront to avoid glitches
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: audioInputDevice
            ? { deviceId: audioInputDevice }
            : undefined,
          audioOutput: audioOutputDevice
            ? { deviceId: audioOutputDevice }
            : undefined,
          // Route audio through Web Audio API - helps avoid OS-level audio ducking
          webAudioMix: true,
        })
        roomRef.current = newRoom

        setupRoomListeners(newRoom, targetInstanceId)

        const wsUrl = response.ws_url || LIVEKIT_URL
        console.log('Connecting to LiveKit:', wsUrl)

        await newRoom.connect(wsUrl, response.token)

        // Small delay to let the WebRTC connection stabilize before enabling audio
        // This helps prevent glitches/pops when joining
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Enable microphone by default (unless in PTT mode)
        // Pass device ID to avoid switching after connection
        if (inputMode === 'vad' && navigator.mediaDevices) {
          try {
            await newRoom.localParticipant.setMicrophoneEnabled(true, {
              deviceId: audioInputDevice || undefined,
            })
          } catch (micError) {
            console.warn('Could not enable microphone:', micError)
          }
        }

        setRoom(newRoom)
        setCurrentChannel(channelId)
        setConnectionState(ConnectionState.Connected)
        // Track which instance has the voice connection
        setVoiceInstanceId(targetInstanceId)

        // Add current user to presence store so they appear in participant list
        if (targetInstanceId) {
          const currentUser = authStores.get(targetInstanceId).getState().user
          if (currentUser) {
            presenceStores.get(targetInstanceId).getState().setVoiceState(currentUser.id, channelId, {
              username: currentUser.username,
              avatarUrl: currentUser.avatar_url,
              muted: false,
              deafened: false,
            })
          }
        }

        // Play join sound for self
        soundManager.play('join')
      } catch (error) {
        console.error('Failed to join voice channel:', error)
        // Clean up on failure
        if (roomRef.current) {
          try {
            await roomRef.current.disconnect()
          } catch {
            // Ignore disconnect errors
          }
          roomRef.current = null
        }
        throw error
      }
    },
    [
      currentChannelId,
      inputMode,
      audioInputDevice,
      audioOutputDevice,
      activeInstanceId,
      setRoom,
      setCurrentChannel,
      setConnectionState,
      setVoiceInstanceId,
      setupRoomListeners,
    ]
  )

  const leaveChannel = useCallback(async () => {
    // Play leave sound for self (before disconnect so we know we were in a channel)
    if (currentChannelId) {
      soundManager.play('leave')
    }

    const currentRoom = roomRef.current
    if (currentRoom) {
      await currentRoom.disconnect()
      roomRef.current = null
    }

    // Remove current user from presence store
    if (voiceInstanceId) {
      const currentUser = authStores.get(voiceInstanceId).getState().user
      if (currentUser) {
        presenceStores.get(voiceInstanceId).getState().setVoiceState(currentUser.id, null)
      }
    }

    // Call API to leave (use the instance that has the voice connection)
    if (currentChannelId && voiceInstanceId) {
      try {
        const instanceApi = getApiClient(voiceInstanceId)
        await instanceApi.leaveVoiceChannel()
      } catch {
        // Ignore errors - we're leaving anyway
      }
    }

    reset()
  }, [currentChannelId, voiceInstanceId, reset])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
    }
  }, [])

  // Check if voice is active on the current instance
  const isVoiceOnCurrentInstance = voiceInstanceId === activeInstanceId

  return {
    room,
    connectionState,
    currentChannelId,
    isMuted,
    isDeafened,
    isVideoEnabled,
    isScreenSharing,
    voiceInstanceId,
    isVoiceOnCurrentInstance,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
  }
}
