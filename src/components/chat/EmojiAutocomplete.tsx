import { useEffect, useRef } from 'react'
import { useEmojiStore } from '@/store/emojiStore'
import { cn } from '@/lib/utils'

interface EmojiAutocompleteProps {
  query: string
  selectedIndex: number
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiAutocomplete({
  query,
  selectedIndex,
  onSelect,
  onClose,
}: EmojiAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const searchEmoji = useEmojiStore((s) => s.searchEmoji)
  const matches = searchEmoji(query)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const selectedEl = containerRef.current.querySelector('[data-selected="true"]')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (matches.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-1 w-64 max-h-64 overflow-y-auto z-50"
    >
      {matches.map((e, index) => (
        <button
          key={e.emoji}
          data-selected={index === selectedIndex}
          onClick={() => onSelect(e.emoji)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left',
            index === selectedIndex ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
          )}
        >
          <span className="text-lg">{e.emoji}</span>
          <span className="text-sm text-zinc-300">:{e.name}:</span>
        </button>
      ))}
    </div>
  )
}
