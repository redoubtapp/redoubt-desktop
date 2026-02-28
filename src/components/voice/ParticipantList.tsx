import { useStore } from 'zustand'
import { MicOff, HeadphoneOff, Video, Monitor } from 'lucide-react'
import { presenceStores } from '@/store/presenceStore'
import { useInstanceStore } from '@/store/instanceStore'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ParticipantListProps {
  channelId: string
}

export function ParticipantList({ channelId }: ParticipantListProps) {
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const presenceStore = presenceStores.get(activeInstanceId)
  // Select presence directly so component re-renders when it changes
  const presence = useStore(presenceStore, (s) => s.presence)
  const participants = Array.from(presence.values()).filter(
    (p) => p.voiceChannelId === channelId
  )

  if (participants.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No one in voice
      </div>
    )
  }

  return (
    <div className="space-y-1 p-2">
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.userId}
          instanceId={activeInstanceId}
          participantId={participant.userId}
        />
      ))}
    </div>
  )
}

interface ParticipantTileProps {
  instanceId: string
  participantId: string
}

function ParticipantTile({ instanceId, participantId }: ParticipantTileProps) {
  const presenceStore = presenceStores.get(instanceId)
  const participant = useStore(presenceStore, (s) => s.presence.get(participantId))

  if (!participant) return null

  const { userId, username, avatarUrl, muted, deafened, video, streaming } = participant

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
      <UserAvatar
        instanceId={instanceId}
        userId={userId}
        username={username}
        avatarUrl={avatarUrl}
        size="sm"
      />

      <span className="flex-1 truncate text-sm text-muted-foreground">
        {username}
      </span>

      <div className="flex items-center gap-0.5">
        {streaming && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Monitor className="h-3 w-3 text-brand" />
            </TooltipTrigger>
            <TooltipContent>Sharing screen</TooltipContent>
          </Tooltip>
        )}

        {video && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Video className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Camera on</TooltipContent>
          </Tooltip>
        )}

        {deafened && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HeadphoneOff className="h-3 w-3 text-destructive" />
            </TooltipTrigger>
            <TooltipContent>Deafened</TooltipContent>
          </Tooltip>
        )}

        {muted && !deafened && (
          <Tooltip>
            <TooltipTrigger asChild>
              <MicOff className="h-3 w-3 text-destructive" />
            </TooltipTrigger>
            <TooltipContent>Muted</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
