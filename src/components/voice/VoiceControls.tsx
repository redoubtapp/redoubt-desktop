import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  VideoOff,
  Monitor,
  PhoneOff,
  Settings,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useVoice } from '@/hooks/useVoice'
import { ConnectionQuality } from './ConnectionQuality'
import { useVoiceStore } from '@/store/voiceStore'

interface VoiceControlsProps {
  onSettingsClick?: () => void
}

export function VoiceControls({ onSettingsClick }: VoiceControlsProps) {
  const {
    currentChannelId,
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    leaveChannel,
  } = useVoice()

  const connectionQuality = useVoiceStore((s) => s.connectionQuality)

  if (!currentChannelId) return null

  return (
    <div className="border-t p-2">
      <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
        <div className="h-2 w-2 animate-pulse rounded-full bg-brand" />
        <span className="text-xs font-medium text-brand">Voice Connected</span>
        <ConnectionQuality quality={connectionQuality} className="ml-auto" />
      </div>

      <div className="flex items-center justify-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isMuted ? 'destructive' : 'secondary'}
              size="icon"
              onClick={toggleMute}
              disabled={isDeafened}
              className="size-9 rounded-full"
            >
              {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isDeafened ? 'destructive' : 'secondary'}
              size="icon"
              onClick={toggleDeafen}
              className="size-9 rounded-full"
            >
              {isDeafened ? (
                <HeadphoneOff className="size-4" />
              ) : (
                <Headphones className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDeafened ? 'Undeafen' : 'Deafen'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="secondary"
                size="icon"
                disabled
                className="size-9 rounded-full"
              >
                <VideoOff className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="secondary"
                size="icon"
                disabled
                className="size-9 rounded-full"
              >
                <Monitor className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>

        {onSettingsClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                onClick={onSettingsClick}
                className="size-9 rounded-full"
              >
                <Settings className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={leaveChannel}
              className="size-9 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <PhoneOff className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
