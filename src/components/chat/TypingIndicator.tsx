import { useStore } from 'zustand'
import { presenceStores } from '@/store/presenceStore'
import { authStores } from '@/store/authStore'

interface TypingIndicatorProps {
  instanceId: string
  channelId: string
}

export function TypingIndicator({ instanceId, channelId }: TypingIndicatorProps) {
  const authStore = authStores.get(instanceId)
  const presenceStore = presenceStores.get(instanceId)
  const currentUserId = useStore(authStore, (s) => s.user?.id)
  const typingList = useStore(presenceStore, (s) => s.typing.get(channelId))

  if (!typingList || typingList.length === 0) return null

  // Filter out current user and get usernames
  const typingUsers = typingList
    .filter((t) => t.userId !== currentUserId)
    .map((t) => t.username)

  if (typingUsers.length === 0) return null

  const getText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`
    }
    return `${typingUsers.length} people are typing...`
  }

  return (
    <div className="px-4 py-1 text-sm text-zinc-500">
      <span className="inline-flex items-center gap-1">
        <TypingDots />
        {getText()}
      </span>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  )
}
