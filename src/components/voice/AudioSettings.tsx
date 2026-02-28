import { useEffect } from 'react'
import { Mic, Volume2, Video, Palette } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useVoiceStore } from '@/store/voiceStore'
import { useAudioDevices } from '@/hooks/useAudioDevices'
import { useSettingsStore, ACCENT_COLORS, type InputMode } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

interface AudioSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AudioSettings({ open, onOpenChange }: AudioSettingsProps) {
  // Get persisted settings
  const {
    audioInputDevice,
    audioOutputDevice,
    videoInputDevice,
    inputMode,
    setAudioInputDevice,
    setAudioOutputDevice,
    setVideoInputDevice,
    setInputMode,
  } = useSettingsStore()

  // Get active room to apply device changes immediately
  const room = useVoiceStore((s) => s.room)

  const { audioInputs, audioOutputs, videoInputs, hasPermission, refresh } =
    useAudioDevices()

  // Apply device to active room when changed
  const handleAudioInputChange = (deviceId: string) => {
    setAudioInputDevice(deviceId)
    // Only switch device if room is connected to avoid peer connection errors
    if (room?.state === 'connected') {
      room.switchActiveDevice('audioinput', deviceId).catch(() => {
        // Silently ignore - setting will still be saved for next connection
      })
    }
  }

  const handleAudioOutputChange = (deviceId: string) => {
    setAudioOutputDevice(deviceId)
    // Only try to switch audio output if room is connected and setSinkId is supported
    // This avoids warnings in browsers/contexts where it's not available
    if (room?.state === 'connected' && 'setSinkId' in HTMLAudioElement.prototype) {
      room.switchActiveDevice('audiooutput', deviceId).catch(() => {
        // Silently ignore - setting will still be saved for next connection
      })
    }
  }

  const handleVideoInputChange = (deviceId: string) => {
    setVideoInputDevice(deviceId)
    // Only switch device if room is connected to avoid peer connection errors
    if (room?.state === 'connected') {
      room.switchActiveDevice('videoinput', deviceId).catch(() => {
        // Silently ignore - setting will still be saved for next connection
      })
    }
  }

  useEffect(() => {
    if (open) {
      refresh()
    }
  }, [open, refresh])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Audio & Video Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!hasPermission && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Please allow microphone and camera access to configure devices.
            </div>
          )}

          <div className="space-y-3">
            <Label>Input Mode</Label>
            <RadioGroup
              value={inputMode}
              onValueChange={(v) => setInputMode(v as InputMode)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vad" id="vad" />
                <Label htmlFor="vad" className="cursor-pointer font-normal">
                  Voice Activity
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ptt" id="ptt" />
                <Label htmlFor="ptt" className="cursor-pointer font-normal">
                  Push to Talk
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {inputMode === 'vad'
                ? 'Your microphone will automatically transmit when you speak.'
                : 'Hold your push-to-talk key to transmit.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphone
            </Label>
            <Select
              value={audioInputDevice || ''}
              onValueChange={handleAudioInputChange}
              disabled={audioInputs.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {audioInputs.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Speakers
            </Label>
            <Select
              value={audioOutputDevice || ''}
              onValueChange={handleAudioOutputChange}
              disabled={audioOutputs.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select speakers" />
              </SelectTrigger>
              <SelectContent>
                {audioOutputs.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Camera
            </Label>
            <Select
              value={videoInputDevice || ''}
              onValueChange={handleVideoInputChange}
              disabled={videoInputs.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {videoInputs.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AccentColorPicker />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AccentColorPicker() {
  const { accentColor, setAccentColor } = useSettingsStore()

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Accent Color
      </Label>
      <div className="flex gap-2">
        {ACCENT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => setAccentColor(color.value)}
            className={cn(
              'h-8 w-8 rounded-full transition-all hover:scale-110',
              accentColor === color.value &&
                'ring-2 ring-white ring-offset-2 ring-offset-background'
            )}
            style={{ backgroundColor: color.preview }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  )
}
