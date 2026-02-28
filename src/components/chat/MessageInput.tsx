import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import { Send, Bold, Italic, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chatStores } from '@/store/chatStore'
import { useInstanceStore } from '@/store/instanceStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEmojiStore } from '@/store/emojiStore'
import { EmojiAutocomplete } from './EmojiAutocomplete'
import { FileUpload, type PendingFile } from './FileUpload'
import { getApiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  channelId: string
  threadId?: string
  placeholder?: string
}

const MAX_LENGTH = 2000

// Regex to find :shortcode pattern at cursor position
function getEmojiQuery(text: string, cursorPos: number): { query: string; start: number } | null {
  // Look backwards from cursor to find the start of a potential shortcode
  let start = cursorPos - 1
  while (start >= 0 && text[start] !== ':' && text[start] !== ' ' && text[start] !== '\n') {
    start--
  }

  // Check if we found a colon
  if (start < 0 || text[start] !== ':') {
    return null
  }

  // Make sure the colon isn't preceded by another colon (already completed shortcode)
  if (start > 0 && text[start - 1] === ':') {
    return null
  }

  // Get the query (text between : and cursor)
  const query = text.substring(start + 1, cursorPos)

  // Only show autocomplete if query is 2+ characters
  if (query.length < 2) {
    return null
  }

  return { query, start }
}

export function MessageInput({
  channelId,
  threadId,
  placeholder = 'Send a message...',
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState<string | null>(null)
  const [autocompleteStart, setAutocompleteStart] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTypingRef = useRef<number>(0)

  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const chatStore = chatStores.get(activeInstanceId)
  const apiClient = getApiClient(activeInstanceId)

  const sendMessage = useStore(chatStore, (s) => s.sendMessage)
  const updateMessage = useStore(chatStore, (s) => s.updateMessage)
  const { sendTyping } = useWebSocket()
  const searchEmoji = useEmojiStore((s) => s.searchEmoji)
  const loadEmoji = useEmojiStore((s) => s.loadEmoji)

  // Load emoji on mount
  useEffect(() => {
    loadEmoji(activeInstanceId)
  }, [loadEmoji, activeInstanceId])

  const charCount = content.length
  const isOverLimit = charCount > MAX_LENGTH
  const showAutocomplete = autocompleteQuery !== null

  // Get matches for keyboard navigation
  const matches = autocompleteQuery ? searchEmoji(autocompleteQuery) : []

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    // Allow sending if there's content OR files
    if ((!trimmed && pendingFiles.length === 0) || isOverLimit || isSending) return

    setIsSending(true)
    try {
      // Send the message first (with content or empty if only files)
      const messageContent = trimmed || (pendingFiles.length > 0 ? '[attachment]' : '')
      const message = await sendMessage(channelId, messageContent, threadId)

      // Upload attachments if any
      if (pendingFiles.length > 0 && message?.id) {
        for (let i = 0; i < pendingFiles.length; i++) {
          try {
            await apiClient.uploadAttachment(message.id, pendingFiles[i].file, i)
          } catch (error) {
            console.error('Failed to upload attachment:', error)
          }
        }
        // Fetch updated message with attachments and update store
        try {
          const updatedMessage = await apiClient.getMessage(message.id)
          updateMessage(channelId, updatedMessage)
        } catch (error) {
          console.error('Failed to fetch updated message:', error)
        }
        // Clean up previews
        pendingFiles.forEach((f) => {
          if (f.preview) URL.revokeObjectURL(f.preview)
        })
        setPendingFiles([])
      }

      setContent('')
      setAutocompleteQuery(null)
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }, [channelId, content, threadId, sendMessage, isOverLimit, isSending, pendingFiles, apiClient, updateMessage])

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (autocompleteQuery === null) return

      const textarea = textareaRef.current
      if (!textarea) return

      // Replace :shortcode with emoji
      const before = content.substring(0, autocompleteStart)
      const after = content.substring(textarea.selectionStart)
      const newContent = before + emoji + after

      setContent(newContent)
      setAutocompleteQuery(null)
      setSelectedIndex(0)

      // Set cursor position after emoji
      const newCursorPos = autocompleteStart + emoji.length
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    },
    [content, autocompleteStart, autocompleteQuery]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle autocomplete navigation
      if (showAutocomplete && matches.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % matches.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + matches.length) % matches.length)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          handleEmojiSelect(matches[selectedIndex].emoji)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setAutocompleteQuery(null)
          setSelectedIndex(0)
          return
        }
      }

      // Normal send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, showAutocomplete, matches, selectedIndex, handleEmojiSelect]
  )

  const handleChange = useCallback(
    (value: string) => {
      setContent(value)

      // Throttle typing indicator to once every 3 seconds
      const now = Date.now()
      if (now - lastTypingRef.current > 3000) {
        lastTypingRef.current = now
        sendTyping(channelId)
      }

      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`

        // Check for emoji shortcode
        const cursorPos = textareaRef.current.selectionStart
        const emojiQuery = getEmojiQuery(value, cursorPos)

        if (emojiQuery) {
          setAutocompleteQuery(emojiQuery.query)
          setAutocompleteStart(emojiQuery.start)
          setSelectedIndex(0)
        } else {
          setAutocompleteQuery(null)
        }
      }
    },
    [channelId, sendTyping]
  )

  const handleCloseAutocomplete = useCallback(() => {
    setAutocompleteQuery(null)
    setSelectedIndex(0)
  }, [])

  const insertMarkdown = useCallback(
    (prefix: string, suffix: string = prefix) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = content
      const selected = text.substring(start, end)

      const newText =
        text.substring(0, start) + prefix + selected + suffix + text.substring(end)
      setContent(newText)

      // Restore cursor position
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + prefix.length, end + prefix.length)
      }, 0)
    },
    [content]
  )

  return (
    <div className="px-4 pb-4">
      <div className="relative bg-zinc-800 rounded-lg border border-zinc-700">
        {/* Emoji Autocomplete */}
        {showAutocomplete && (
          <EmojiAutocomplete
            query={autocompleteQuery}
            selectedIndex={selectedIndex}
            onSelect={handleEmojiSelect}
            onClose={handleCloseAutocomplete}
          />
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-700">
          <FileUpload
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            disabled={isSending}
          />
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertMarkdown('**')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertMarkdown('*')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertMarkdown('`')}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 min-h-[40px] max-h-[200px] resize-none bg-transparent border-0 text-zinc-200 placeholder:text-zinc-500 focus:outline-none text-sm"
            rows={1}
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={(!content.trim() && pendingFiles.length === 0) || isOverLimit || isSending}
            size="icon"
            className="h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Character count */}
        <div className="px-3 pb-1 text-right">
          <span
            className={cn(
              'text-xs',
              isOverLimit ? 'text-red-400' : 'text-zinc-500'
            )}
          >
            {charCount}/{MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}
