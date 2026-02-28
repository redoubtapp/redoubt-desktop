import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmojiAutocomplete } from './EmojiAutocomplete'
import { useEmojiStore } from '@/store/emojiStore'
import { useInstanceStore } from '@/store/instanceStore'

interface ThreadReplyInputProps {
  onSubmit: (content: string) => Promise<void>
  onCancel: () => void
}

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

export function ThreadReplyInput({ onSubmit, onCancel }: ThreadReplyInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState<string | null>(null)
  const [autocompleteStart, setAutocompleteStart] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const searchEmoji = useEmojiStore((s) => s.searchEmoji)
  const loadEmoji = useEmojiStore((s) => s.loadEmoji)

  // Load emoji on mount
  useEffect(() => {
    loadEmoji(activeInstanceId)
  }, [loadEmoji, activeInstanceId])

  const showAutocomplete = autocompleteQuery !== null
  const matches = autocompleteQuery ? searchEmoji(autocompleteQuery) : []

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      await onSubmit(trimmed)
      setContent('')
      setAutocompleteQuery(null)
    } catch (error) {
      console.error('Failed to send reply:', error)
    } finally {
      setIsSending(false)
    }
  }, [content, isSending, onSubmit])

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (autocompleteQuery === null) return

      const input = inputRef.current
      if (!input) return

      // Replace :shortcode with emoji
      const before = content.substring(0, autocompleteStart)
      const after = content.substring(input.selectionStart ?? content.length)
      const newContent = before + emoji + after

      setContent(newContent)
      setAutocompleteQuery(null)
      setSelectedIndex(0)

      // Set cursor position after emoji
      const newCursorPos = autocompleteStart + emoji.length
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    },
    [content, autocompleteStart, autocompleteQuery]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
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

      // Normal send on Enter
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        onCancel()
      }
    },
    [handleSubmit, onCancel, showAutocomplete, matches, selectedIndex, handleEmojiSelect]
  )

  const handleChange = useCallback((value: string) => {
    setContent(value)

    // Check for emoji shortcode
    const input = inputRef.current
    if (input) {
      const cursorPos = input.selectionStart ?? value.length
      const emojiQuery = getEmojiQuery(value, cursorPos)

      if (emojiQuery) {
        setAutocompleteQuery(emojiQuery.query)
        setAutocompleteStart(emojiQuery.start)
        setSelectedIndex(0)
      } else {
        setAutocompleteQuery(null)
      }
    }
  }, [])

  const handleCloseAutocomplete = useCallback(() => {
    setAutocompleteQuery(null)
    setSelectedIndex(0)
  }, [])

  return (
    <div className="relative flex items-center gap-2 mt-2">
      {/* Emoji Autocomplete */}
      {showAutocomplete && (
        <EmojiAutocomplete
          query={autocompleteQuery}
          selectedIndex={selectedIndex}
          onSelect={handleEmojiSelect}
          onClose={handleCloseAutocomplete}
        />
      )}
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Reply to thread..."
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
        disabled={isSending}
      />
      <Button
        size="icon"
        className="h-8 w-8"
        onClick={handleSubmit}
        disabled={!content.trim() || isSending}
      >
        <Send className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
