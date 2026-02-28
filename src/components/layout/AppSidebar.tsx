import { useState } from 'react'
import { useStore } from 'zustand'
import {
  Hash,
  Volume2,
  Plus,
  Settings,
  User,
  LogOut,
  ChevronsUpDown,
  MicOff,
  UserPlus,
} from 'lucide-react'
import { useSettingsStore, ACCENT_COLORS } from '@/store/settingsStore'
import { spaceStores } from '@/store/spaceStore'
import { authStores } from '@/store/authStore'
import { presenceStores } from '@/store/presenceStore'
import { useInstanceStore } from '@/store/instanceStore'
import { useVoice } from '@/hooks/useVoice'
import { VoiceControls } from '@/components/voice/VoiceControls'
import { AudioSettings } from '@/components/voice/AudioSettings'
import { UserSettings } from '@/components/settings/UserSettings'
import { InviteMembersDialog } from '@/components/settings/InviteMembersDialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

// Individual participant row that subscribes to speaking state changes
function VoiceParticipantRow({
  instanceId,
  participantId,
}: {
  instanceId: string
  participantId: string
}) {
  const presenceStore = presenceStores.get(instanceId)
  // Subscribe directly to this participant's data for reactive speaking updates
  const participant = useStore(presenceStore, (s) => s.presence.get(participantId))
  const accentColor = useSettingsStore((s) => s.accentColor)

  if (!participant) return null

  const { username, avatarUrl, muted, speaking } = participant

  // Get the HSL color for the current accent
  const accentHsl = ACCENT_COLORS.find((c) => c.value === accentColor)?.preview || 'hsl(220, 100%, 60%)'

  return (
    <div className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground">
      <div
        className="rounded-full transition-all duration-150"
        style={speaking ? {
          outline: `3px solid ${accentHsl}`,
          outlineOffset: '2px',
          boxShadow: `0 0 10px 2px ${accentHsl}`,
        } : undefined}
      >
        <UserAvatar
          instanceId={instanceId}
          userId={participantId}
          username={username}
          avatarUrl={avatarUrl}
          size="sm"
          className="size-5"
        />
      </div>
      <span className="truncate text-xs">{username}</span>
      {muted && (
        <MicOff className="ml-auto size-3 text-destructive" />
      )}
    </div>
  )
}

function VoiceChannelItem({
  channelId,
  channelName,
  isInChannel,
  onClick,
}: {
  channelId: string
  channelName: string
  isInChannel: boolean
  onClick: () => void
}) {
  // Subscribe to presence map changes and filter for this channel
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const presenceStore = presenceStores.get(activeInstanceId)
  const presence = useStore(presenceStore, (s) => s.presence)
  const participantIds = Array.from(presence.values())
    .filter((p) => p.voiceChannelId === channelId)
    .map((p) => p.userId)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isInChannel} onClick={onClick}>
        <Volume2 className="size-4" />
        <span>{channelName}</span>
        {participantIds.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {participantIds.length}
          </span>
        )}
      </SidebarMenuButton>
      {participantIds.length > 0 && (
        <div className="ml-6 space-y-0.5 py-1">
          {participantIds.map((participantId) => (
            <VoiceParticipantRow
              key={participantId}
              instanceId={activeInstanceId}
              participantId={participantId}
            />
          ))}
        </div>
      )}
    </SidebarMenuItem>
  )
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  instanceId: string
}

export function AppSidebar({ instanceId, ...props }: AppSidebarProps) {
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false)
  const [userSettingsOpen, setUserSettingsOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text')
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)

  const spaceStore = spaceStores.get(instanceId)
  const spaces = useStore(spaceStore, (s) => s.spaces)
  const currentSpaceId = useStore(spaceStore, (s) => s.currentSpaceId)
  const selectSpace = useStore(spaceStore, (s) => s.selectSpace)
  const createSpace = useStore(spaceStore, (s) => s.createSpace)
  const createChannel = useStore(spaceStore, (s) => s.createChannel)
  const channels = useStore(spaceStore, (s) => s.channels)
  const currentChannelId = useStore(spaceStore, (s) => s.currentChannelId)
  const selectChannel = useStore(spaceStore, (s) => s.selectChannel)
  const members = useStore(spaceStore, (s) => s.members)

  const authStore = authStores.get(instanceId)
  const user = useStore(authStore, (s) => s.user)
  const logout = useStore(authStore, (s) => s.logout)

  const { currentChannelId: voiceChannelId, joinChannel } = useVoice()

  const currentSpace = spaces.find((s) => s.id === currentSpaceId)
  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  // Check if current user is admin or owner of the space
  const currentMember = members.find((m) => m.user_id === user?.id)
  const isSpaceAdmin =
    currentMember?.role === 'admin' ||
    currentMember?.role === 'owner' ||
    currentSpace?.owner_id === user?.id

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return
    setIsCreating(true)
    try {
      const space = await createSpace(newSpaceName.trim())
      setIsCreateDialogOpen(false)
      setNewSpaceName('')
      selectSpace(space.id)
    } catch (error) {
      console.error('Failed to create space:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentSpaceId) return
    setIsCreatingChannel(true)
    try {
      const channel = await createChannel(currentSpaceId, newChannelName.trim(), newChannelType)
      setIsCreateChannelOpen(false)
      setNewChannelName('')
      setNewChannelType('text')
      selectChannel(channel.id)
    } catch (error) {
      console.error('Failed to create channel:', error)
    } finally {
      setIsCreatingChannel(false)
    }
  }

  const openCreateChannel = (type: 'text' | 'voice') => {
    setNewChannelType(type)
    setIsCreateChannelOpen(true)
  }

  const handleVoiceChannelClick = async (channelId: string) => {
    if (voiceChannelId === channelId) return
    try {
      await joinChannel(channelId)
    } catch (error) {
      console.error('Failed to join voice channel:', error)
    }
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    {currentSpace?.icon_url && (
                      <AvatarImage
                        src={currentSpace.icon_url}
                        alt={currentSpace.name}
                      />
                    )}
                    <AvatarFallback className="rounded-lg">
                      {currentSpace?.name.charAt(0).toUpperCase() || 'R'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-base leading-tight">
                    <span className="truncate font-medium">
                      {currentSpace?.name || 'Select a space'}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {channels.length} channels
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                {spaces.map((space) => (
                  <DropdownMenuItem
                    key={space.id}
                    onClick={() => selectSpace(space.id)}
                    className="gap-2 p-2"
                  >
                    <Avatar className="h-6 w-6 rounded-md">
                      {space.icon_url && (
                        <AvatarImage src={space.icon_url} alt={space.name} />
                      )}
                      <AvatarFallback className="rounded-md text-xs">
                        {space.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {space.name}
                  </DropdownMenuItem>
                ))}
                {isSpaceAdmin && currentSpaceId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsInviteDialogOpen(true)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                        <UserPlus className="size-4" />
                      </div>
                      <span className="text-muted-foreground">Invite members</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Plus className="size-4" />
                  </div>
                  <span className="text-muted-foreground">Create space</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {!currentSpaceId ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Select a space to view channels
          </div>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>
                Text Channels
                <SidebarGroupAction title="Create text channel" onClick={() => openCreateChannel('text')}>
                  <Plus className="size-4" />
                </SidebarGroupAction>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {textChannels.map((channel) => (
                    <SidebarMenuItem key={channel.id}>
                      <SidebarMenuButton
                        isActive={currentChannelId === channel.id}
                        onClick={() => selectChannel(channel.id)}
                      >
                        <Hash className="size-4" />
                        <span>{channel.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                Voice Channels
                <SidebarGroupAction title="Create voice channel" onClick={() => openCreateChannel('voice')}>
                  <Plus className="size-4" />
                </SidebarGroupAction>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {voiceChannels.map((channel) => {
                    const isInChannel = voiceChannelId === channel.id
                    return (
                      <VoiceChannelItem
                        key={channel.id}
                        channelId={channel.id}
                        channelName={channel.name}
                        isInChannel={isInChannel}
                        onClick={() => handleVoiceChannelClick(channel.id)}
                      />
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {voiceChannelId && (
        <VoiceControls onSettingsClick={() => setAudioSettingsOpen(true)} />
      )}

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  {user ? (
                    <UserAvatar
                      instanceId={instanceId}
                      userId={user.id}
                      username={user.username}
                      avatarUrl={user.avatar_url}
                      className="h-8 w-8 rounded-lg"
                    />
                  ) : (
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">?</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="grid flex-1 text-left text-base leading-tight">
                    <span className="truncate font-medium">
                      {user?.username || 'Unknown'}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      Online
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => setUserSettingsOpen(true)}>
                  <User className="mr-2 size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAudioSettingsOpen(true)}>
                  <Settings className="mr-2 size-4" />
                  Audio & Video
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      <AudioSettings open={audioSettingsOpen} onOpenChange={setAudioSettingsOpen} />
      <UserSettings instanceId={instanceId} open={userSettingsOpen} onOpenChange={setUserSettingsOpen} />
      <InviteMembersDialog instanceId={instanceId} open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen} />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a space</DialogTitle>
            <DialogDescription>
              Give your new space a name. You can always change it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Space name"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreateSpace()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setNewSpaceName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSpace}
              disabled={!newSpaceName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create a {newChannelType} channel
            </DialogTitle>
            <DialogDescription>
              Give your new channel a name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Channel name</Label>
              <Input
                id="channel-name"
                placeholder={newChannelType === 'text' ? 'general' : 'voice-chat'}
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingChannel) {
                    handleCreateChannel()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Channel type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel-type"
                    checked={newChannelType === 'text'}
                    onChange={() => setNewChannelType('text')}
                    className="size-4"
                  />
                  <Hash className="size-4" />
                  <span>Text</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel-type"
                    checked={newChannelType === 'voice'}
                    onChange={() => setNewChannelType('voice')}
                    className="size-4"
                  />
                  <Volume2 className="size-4" />
                  <span>Voice</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsCreateChannelOpen(false)
                setNewChannelName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateChannel}
              disabled={!newChannelName.trim() || isCreatingChannel}
            >
              {isCreatingChannel ? 'Creating...' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
