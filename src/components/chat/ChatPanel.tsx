import { useEffect } from 'react'
import { useStore } from 'zustand'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { chatStores } from '@/store/chatStore'
import { useInstanceStore } from '@/store/instanceStore'
import { Hash } from 'lucide-react'

interface ChatPanelProps {
  channelId: string
  channelName: string
}

export function ChatPanel({ channelId, channelName }: ChatPanelProps) {
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const chatStore = chatStores.get(activeInstanceId)
  const markAsRead = useStore(chatStore, (s) => s.markAsRead)

  // Mark as read when leaving the channel
  useEffect(() => {
    return () => {
      markAsRead(channelId)
    }
  }, [channelId, markAsRead])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-zinc-900">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Hash className="h-5 w-5 text-zinc-400" />
        <h2 className="font-semibold text-zinc-200">{channelName}</h2>
      </div>

      {/* Messages */}
      <MessageList channelId={channelId} />

      {/* Typing indicator */}
      <TypingIndicator instanceId={activeInstanceId} channelId={channelId} />

      {/* Input */}
      <MessageInput channelId={channelId} placeholder={`Message #${channelName}`} />
    </div>
  )
}
