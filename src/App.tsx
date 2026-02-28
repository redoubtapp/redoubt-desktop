import { useState, useEffect } from "react"
import { useStore } from "zustand"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useInstanceStore } from "@/store/instanceStore"
import { authStores } from "@/store/authStore"
import { spaceStores } from "@/store/spaceStore"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts"
import { useVoiceStore } from "@/store/voiceStore"
import { LoginForm } from "@/components/auth/LoginForm"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { UserAvatar } from "@/components/ui/user-avatar"
import { Users, Volume2, Loader2 } from "lucide-react"
import { ParticipantList } from "@/components/voice/ParticipantList"
import { ChatPanel } from "@/components/chat"
import { InstanceTabBar, NoInstancesView } from "@/components/instance"

interface AuthPageProps {
  instanceId: string
}

function AuthPage({ instanceId }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        {isLogin ? (
          <LoginForm
            instanceId={instanceId}
            onSwitchToRegister={() => setIsLogin(false)}
          />
        ) : (
          <RegisterForm
            instanceId={instanceId}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  )
}

interface MainContentProps {
  instanceId: string
}

function MainContent({ instanceId }: MainContentProps) {
  const spaceStore = spaceStores.get(instanceId)
  const channels = useStore(spaceStore, (s) => s.channels)
  const currentChannelId = useStore(spaceStore, (s) => s.currentChannelId)
  const members = useStore(spaceStore, (s) => s.members)
  const voiceChannelId = useVoiceStore((s) => s.currentChannelId)
  const currentChannel = channels.find((c) => c.id === currentChannelId)

  if (!currentChannel) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Select a channel to get started</p>
      </div>
    )
  }

  const isVoiceChannel = currentChannel.type === "voice"
  const isInVoiceChannel = voiceChannelId === currentChannel.id

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {isVoiceChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Volume2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold">{currentChannel.name}</h2>
              <p className="mt-2 text-muted-foreground">
                {isInVoiceChannel
                  ? "You are connected to this voice channel."
                  : "Click to join this voice channel."}
              </p>
            </div>
          </div>
        ) : (
          <ChatPanel
            channelId={currentChannel.id}
            channelName={currentChannel.name}
          />
        )}
      </div>

      <div className="hidden w-60 shrink-0 border-l lg:flex lg:flex-col min-h-0 overflow-y-auto">
        <div className="p-4">
          {isVoiceChannel && isInVoiceChannel ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                Voice Connected
              </div>
              <ParticipantList channelId={currentChannel.id} />
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Users className="h-4 w-4" />
                Members - {members.length}
              </div>
              <div className="space-y-1">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <div className="relative">
                      <UserAvatar
                        instanceId={instanceId}
                        userId={member.user_id}
                        username={member.username}
                        avatarUrl={member.avatar_url}
                        size="default"
                      />
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                    </div>
                    <span className="truncate text-sm">{member.username}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface MainLayoutProps {
  instanceId: string
}

function MainLayout({ instanceId }: MainLayoutProps) {
  const spaceStore = spaceStores.get(instanceId)
  const loadSpaces = useStore(spaceStore, (s) => s.loadSpaces)
  const currentSpaceId = useStore(spaceStore, (s) => s.currentSpaceId)

  const { subscribeToSpace, unsubscribeFromSpace } = useWebSocket()
  useGlobalShortcuts()

  useEffect(() => {
    loadSpaces()
  }, [loadSpaces])

  // Subscribe to space presence events when space changes
  useEffect(() => {
    if (currentSpaceId) {
      subscribeToSpace(currentSpaceId)
      return () => {
        unsubscribeFromSpace(currentSpaceId)
      }
    }
  }, [currentSpaceId, subscribeToSpace, unsubscribeFromSpace])

  return (
    <SidebarProvider
      className="flex-1 min-h-0 overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" instanceId={instanceId} />
      <SidebarInset className="overflow-hidden">
        <SiteHeader instanceId={instanceId} />
        <div className="flex flex-1 flex-col min-h-0">
          <MainContent instanceId={instanceId} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

interface InstanceContentProps {
  instanceId: string
}

function InstanceContent({ instanceId }: InstanceContentProps) {
  const authStore = authStores.get(instanceId)
  const user = useStore(authStore, (s) => s.user)
  const [isLoading, setIsLoading] = useState(true)

  // Load auth from storage on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        await authStore.getState().loadFromStorage()
      } finally {
        setIsLoading(false)
      }
    }
    loadAuth()
  }, [authStore])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage instanceId={instanceId} />
  }

  return <MainLayout instanceId={instanceId} />
}

function InstanceAwareApp() {
  const { instances, activeInstanceId, setActiveInstance } = useInstanceStore()

  // Auto-select first instance if none selected
  useEffect(() => {
    if (instances.length > 0 && !activeInstanceId) {
      setActiveInstance(instances[0].id)
    }
  }, [instances, activeInstanceId, setActiveInstance])

  // No instances - show welcome view
  if (instances.length === 0) {
    return <NoInstancesView />
  }

  // Waiting for active instance to be set
  if (!activeInstanceId) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <InstanceTabBar />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <InstanceContent instanceId={activeInstanceId} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <InstanceAwareApp />
    </TooltipProvider>
  )
}
