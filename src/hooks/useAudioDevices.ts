import { useState, useCallback } from 'react'

interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

export function useAudioDevices() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [hasPermission, setHasPermission] = useState(false)

  const refresh = useCallback(async () => {
    // Check for secure context and mediaDevices availability
    if (!navigator.mediaDevices?.enumerateDevices) {
      console.warn(
        'Media devices not available. This feature requires a secure context (HTTPS or localhost).'
      )
      setHasPermission(false)
      return
    }

    try {
      // First try to enumerate devices without requesting new permissions
      // If we already have permission (e.g., from an active voice call), labels will be available
      let devices = await navigator.mediaDevices.enumerateDevices()

      // Check if we have labels for audio and video separately
      const hasAudioLabels = devices.some((d) => d.kind === 'audioinput' && d.label && d.label.length > 0)
      const hasVideoLabels = devices.some((d) => d.kind === 'videoinput' && d.label && d.label.length > 0)

      // Only request permissions for types we don't have yet
      if ((!hasAudioLabels || !hasVideoLabels) && navigator.mediaDevices.getUserMedia) {
        try {
          const constraints: MediaStreamConstraints = {}
          if (!hasAudioLabels) constraints.audio = true
          if (!hasVideoLabels) constraints.video = true

          if (Object.keys(constraints).length > 0) {
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            // Stop the tracks immediately - we just needed permission
            stream.getTracks().forEach((track) => track.stop())
            // Re-enumerate to get labels
            devices = await navigator.mediaDevices.enumerateDevices()
          }
        } catch {
          // Permission denied or failed, continue with what we have
        }
      }

      setHasPermission(devices.some((d) => d.label && d.label.length > 0))

      setAudioInputs(
        devices
          .filter((d) => d.kind === 'audioinput' && d.deviceId)
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
            kind: d.kind,
          }))
      )

      setAudioOutputs(
        devices
          .filter((d) => d.kind === 'audiooutput' && d.deviceId)
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
            kind: d.kind,
          }))
      )

      setVideoInputs(
        devices
          .filter((d) => d.kind === 'videoinput' && d.deviceId)
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
            kind: d.kind,
          }))
      )
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
      setHasPermission(false)
    }
  }, [])

  return { audioInputs, audioOutputs, videoInputs, hasPermission, refresh }
}
