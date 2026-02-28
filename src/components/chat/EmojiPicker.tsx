import { useEffect } from 'react'
import { useEmojiStore } from '@/store/emojiStore'
import { useInstanceStore } from '@/store/instanceStore'
import { Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const emoji = useEmojiStore((s) => s.emoji)
  const categories = useEmojiStore((s) => s.categories)
  const isLoading = useEmojiStore((s) => s.isLoading)
  const isLoaded = useEmojiStore((s) => s.isLoaded)
  const loadEmoji = useEmojiStore((s) => s.loadEmoji)

  useEffect(() => {
    if (!isLoaded && !isLoading) {
      loadEmoji(activeInstanceId)
    }
  }, [isLoaded, isLoading, loadEmoji, activeInstanceId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (emoji.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-zinc-500">
        No emoji available
      </div>
    )
  }

  // Group emoji by category
  const emojiByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = emoji.filter((e) => e.category === category)
      return acc
    },
    {} as Record<string, typeof emoji>
  )

  return (
    <ScrollArea className="h-64 w-64">
      <div className="p-2">
        {categories.map((category) => (
          <div key={category} className="mb-3">
            <div className="text-xs font-medium text-zinc-500 mb-1 px-1">
              {category}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {emojiByCategory[category].map((e) => (
                <button
                  key={e.emoji}
                  onClick={() => onSelect(e.emoji)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-zinc-700 text-lg"
                  title={e.name}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
