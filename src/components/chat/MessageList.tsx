import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useStore } from 'zustand'
import { chatStores } from '@/store/chatStore'
import { useInstanceStore } from '@/store/instanceStore'
import { MessageItem } from './MessageItem'
import { MessageDateDivider } from './MessageDateDivider'
import { Loader2 } from 'lucide-react'
import type { Message } from '@/types/api'

interface MessageListProps {
  channelId: string
}

// Stable empty array to avoid infinite loops with zustand selectors
const EMPTY_MESSAGES: Message[] = []

interface MessageGroup {
  date: string
  messages: Message[]
}

function groupMessagesByDate(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentGroup: MessageGroup | null = null

  for (const message of messages) {
    const date = new Date(message.created_at).toLocaleDateString()
    if (!currentGroup || currentGroup.date !== date) {
      currentGroup = { date, messages: [] }
      groups.push(currentGroup)
    }
    currentGroup.messages.push(message)
  }

  return groups
}

function shouldShowAuthor(messages: Message[], index: number): boolean {
  if (index === 0) return true
  const prev = messages[index - 1]
  const curr = messages[index]

  // Show author if different user or more than 5 minutes apart
  if (prev.author.id !== curr.author.id) return true

  const timeDiff =
    new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
  return timeDiff > 5 * 60 * 1000
}

export function MessageList({ channelId }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const chatStore = chatStores.get(activeInstanceId)

  const rawMessages = useStore(chatStore, (s) => s.messagesByChannel.get(channelId))
  const messages = useMemo(() => rawMessages ?? EMPTY_MESSAGES, [rawMessages])
  const hasMore = useStore(chatStore, (s) => s.hasMore.get(channelId) ?? true)
  const isLoading = useStore(chatStore, (s) => s.isLoading)
  const loadMessages = useStore(chatStore, (s) => s.loadMessages)
  const loadMore = useStore(chatStore, (s) => s.loadMore)

  // Load initial messages
  useEffect(() => {
    if (messages.length === 0) {
      loadMessages(channelId)
    }
  }, [channelId, messages.length, loadMessages])

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (bottomRef.current && messages.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Load more on scroll to top
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = e.currentTarget
      if (scrollTop < 100 && hasMore && !isLoading) {
        loadMore(channelId)
      }
    },
    [channelId, hasMore, isLoading, loadMore]
  )

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages as Message[])

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <p>No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto px-4 pb-4"
    >
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      )}

      {groupedMessages.map((group) => (
        <div key={group.date}>
          <MessageDateDivider date={group.date} />
          {group.messages.map((message, msgIndex) => (
            <MessageItem
              key={message.id}
              message={message}
              showAuthor={shouldShowAuthor(group.messages, msgIndex)}
            />
          ))}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  )
}
