import { useState, useEffect } from 'react'
import { useStore } from 'zustand'
import { MessageItem } from './MessageItem'
import { ThreadReplyInput } from './ThreadReplyInput'
import { chatStores } from '@/store/chatStore'
import { useInstanceStore } from '@/store/instanceStore'
import { Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Message } from '@/types/api'

interface ThreadProps {
  parentMessage: Message
  onReplyStart?: () => void
  startReplying?: boolean
}

const PREVIEW_COUNT = 3

export function Thread({ parentMessage, onReplyStart, startReplying = false }: ThreadProps) {
  const [isExpanded, setIsExpanded] = useState(startReplying)
  const [isReplying, setIsReplying] = useState(startReplying)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [allReplies, setAllReplies] = useState<Message[] | null>(null)

  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const chatStore = chatStores.get(activeInstanceId)

  const loadThreadReplies = useStore(chatStore, (s) => s.loadThreadReplies)
  const replyToThread = useStore(chatStore, (s) => s.replyToThread)
  const threadReplies = useStore(chatStore, (s) => s.threadReplies.get(parentMessage.id))
  const isLoading = useStore(chatStore, (s) => s.threadLoading.has(parentMessage.id))

  const totalReplies = parentMessage.reply_count
  const hasMoreReplies = totalReplies > PREVIEW_COUNT

  // Use cached replies if available, otherwise show preview from threadReplies
  const displayedReplies = allReplies ?? threadReplies?.slice(0, PREVIEW_COUNT) ?? []
  const remainingCount = totalReplies - displayedReplies.length

  // Load initial preview when expanded
  useEffect(() => {
    if (isExpanded && !threadReplies && !isLoading) {
      loadThreadReplies(parentMessage.id).catch(console.error)
    }
  }, [isExpanded, threadReplies, isLoading, loadThreadReplies, parentMessage.id])

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      const replies = await loadThreadReplies(parentMessage.id)
      setAllReplies(replies)
    } catch (error) {
      console.error('Failed to load thread replies:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleReply = async (content: string) => {
    try {
      await replyToThread(parentMessage.id, content)
      setIsReplying(false)
      // Reload replies to include the new one
      const replies = await loadThreadReplies(parentMessage.id)
      setAllReplies(replies)
    } catch (error) {
      console.error('Failed to reply to thread:', error)
      throw error
    }
  }

  const handleStartReply = () => {
    setIsExpanded(true)
    setIsReplying(true)
    onReplyStart?.()
  }

  if (totalReplies === 0 && !isReplying) {
    return null
  }

  return (
    <div
      className="mt-2 ml-12 border-l-2 border-zinc-700 pl-4"
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      {/* Thread header / toggle */}
      {totalReplies > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span>
            {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Replies list */}
      {isExpanded && (
        <>
          {isLoading && displayedReplies.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading replies...
            </div>
          ) : (
            <>
              {displayedReplies.map((reply, index) => {
                const isFirstOrNewAuthor = index === 0 || displayedReplies[index - 1]?.author.id !== reply.author.id
                return (
                  <MessageItem
                    key={reply.id}
                    message={reply}
                    showAuthor={isFirstOrNewAuthor}
                    compact={!isFirstOrNewAuthor}
                    isThreadReply
                  />
                )
              })}

              {/* Load more button */}
              {hasMoreReplies && remainingCount > 0 && !allReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="text-blue-400 hover:text-blue-300 mt-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    `Load ${remainingCount} more ${remainingCount === 1 ? 'reply' : 'replies'}`
                  )}
                </Button>
              )}
            </>
          )}
        </>
      )}

      {/* Reply input - only show when expanded */}
      {isExpanded && (
        isReplying ? (
          <ThreadReplyInput
            onSubmit={handleReply}
            onCancel={() => setIsReplying(false)}
          />
        ) : (
          <button
            onClick={handleStartReply}
            className="text-sm text-zinc-400 hover:text-zinc-200 mt-2"
          >
            Reply to thread...
          </button>
        )
      )}
    </div>
  )
}
