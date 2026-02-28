import { useState, useMemo } from 'react'
import { useStore } from 'zustand'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { MessageContent } from './MessageContent'
import { EmojiPicker } from './EmojiPicker'
import { Thread } from './Thread'
import { LinkPreview } from './LinkPreview'
import { AttachmentPreview } from './AttachmentPreview'
import { MoreHorizontal, Pencil, Trash2, SmilePlus, AlertCircle, MessageSquareReply } from 'lucide-react'
import { authStores } from '@/store/authStore'
import { chatStores } from '@/store/chatStore'
import { useInstanceStore } from '@/store/instanceStore'
import type { Message } from '@/types/api'

// Extract URLs from text content
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>\[\]()]+/g
  const matches = text.match(urlRegex) || []

  // Deduplicate and clean trailing punctuation
  const seen = new Set<string>()
  return matches
    .map((m) => m.replace(/[.,;:!?"')]+$/, ''))
    .filter((url) => {
      if (seen.has(url)) return false
      seen.add(url)
      return true
    })
}

interface OptimisticMessage extends Message {
  nonce: string
  pending: boolean
  failed: boolean
}

function isOptimistic(msg: Message | OptimisticMessage): msg is OptimisticMessage {
  return 'nonce' in msg && 'pending' in msg
}

interface MessageItemProps {
  message: Message | OptimisticMessage
  showAuthor?: boolean
  compact?: boolean
  isThreadReply?: boolean
}

export function MessageItem({
  message,
  showAuthor = true,
  compact = false,
  isThreadReply = false,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [showThread, setShowThread] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const authStore = authStores.get(activeInstanceId)
  const chatStore = chatStores.get(activeInstanceId)

  const currentUser = useStore(authStore, (s) => s.user)
  const editMessage = useStore(chatStore, (s) => s.editMessage)
  const deleteMessage = useStore(chatStore, (s) => s.deleteMessage)
  const toggleReaction = useStore(chatStore, (s) => s.toggleReaction)
  const retryMessage = useStore(chatStore, (s) => s.retryMessage)
  const discardMessage = useStore(chatStore, (s) => s.discardMessage)

  const isOwn = currentUser?.id === message.author.id
  const isPending = isOptimistic(message) && message.pending
  const isFailed = isOptimistic(message) && message.failed
  const isEdited = !!message.edited_at

  // Extract URLs for link previews
  const urls = useMemo(() => extractUrls(message.content), [message.content])

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleEdit = async () => {
    if (editContent.trim() === message.content) {
      setIsEditing(false)
      return
    }
    try {
      await editMessage(message.id, editContent.trim())
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to edit message:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMessage(message.id)
    } catch (error) {
      console.error('Failed to delete message:', error)
    }
  }

  const handleRetry = () => {
    if (isOptimistic(message)) {
      retryMessage(message.channel_id, message.nonce)
    }
  }

  const handleDiscard = () => {
    if (isOptimistic(message)) {
      discardMessage(message.channel_id, message.nonce)
    }
  }

  const handleReaction = async (emoji: string) => {
    setEmojiOpen(false)
    try {
      await toggleReaction(message.id, emoji)
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  // Failed message display
  if (isFailed) {
    return (
      <div className="py-2 px-4 bg-red-900/20 border-l-2 border-red-500 rounded-r">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to send</span>
        </div>
        <div className="mt-1 text-zinc-300">{message.content}</div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDiscard}>
            Discard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded px-2 -mx-2',
        showAuthor ? 'pt-4 pb-0.5' : 'py-0',
        compact && 'py-0',
        isPending && 'opacity-60',
        isHovered && 'bg-zinc-800/50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        {/* Avatar column - only render when showing author */}
        {showAuthor && !compact ? (
          <div className="w-10 flex-shrink-0">
            <UserAvatar
              instanceId={activeInstanceId}
              userId={message.author.id}
              username={message.author.username}
              avatarUrl={message.author.avatar_url}
              size="default"
            />
          </div>
        ) : (
          <div className="w-10 flex-shrink-0 flex items-center justify-end">
            <span className={cn('text-[10px] text-zinc-600', isHovered ? 'opacity-100' : 'opacity-0')}>
              {formatTime(message.created_at)}
            </span>
          </div>
        )}

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {showAuthor && !compact && (
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-zinc-100">
                {message.author.username}
              </span>
              <span className="text-xs text-zinc-500">
                {formatTime(message.created_at)}
              </span>
              {isEdited && (
                <span className="text-xs text-zinc-500">(edited)</span>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleEdit()
                  }
                  if (e.key === 'Escape') {
                    setIsEditing(false)
                    setEditContent(message.content)
                  }
                }}
              />
              <div className="flex gap-2 mt-1">
                <Button size="sm" onClick={handleEdit}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false)
                    setEditContent(message.content)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Hide placeholder text when we have actual attachments */}
              {!(message.content === '[attachment]' && message.attachments && message.attachments.length > 0) && (
                <MessageContent content={message.content} />
              )}
              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <AttachmentPreview instanceId={activeInstanceId} attachments={message.attachments} />
              )}
              {/* Link previews */}
              {urls.length > 0 && !isPending && (
                <div className="space-y-2">
                  {urls.slice(0, 3).map((url) => (
                    <LinkPreview key={url} url={url} messageId={message.id} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReaction(reaction.emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm',
                    'bg-zinc-800 hover:bg-zinc-700 transition-colors',
                    reaction.has_reacted && 'ring-1 ring-blue-500 bg-blue-500/10'
                  )}
                  title={reaction.users.join(', ')}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-zinc-400">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions (visible on hover) */}
        {!isPending && !isEditing && (
          <div className={cn('absolute right-2 top-0 flex gap-0.5 bg-zinc-800 rounded border border-zinc-700 p-0.5', isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Add reaction"
                >
                  <SmilePlus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <EmojiPicker onSelect={handleReaction} />
              </PopoverContent>
            </Popover>
            {!isThreadReply && !message.thread_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Reply in thread"
                onClick={() => setShowThread(true)}
              >
                <MessageSquareReply className="h-4 w-4" />
              </Button>
            )}
            {isOwn && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Edit"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
      </div>

      {/* Thread replies */}
      {!isThreadReply && !message.thread_id && (message.is_thread_root || message.reply_count > 0 || showThread) && (
        <Thread
          parentMessage={message}
          onReplyStart={() => setShowThread(true)}
          startReplying={showThread && message.reply_count === 0}
        />
      )}
    </div>
  )
}
