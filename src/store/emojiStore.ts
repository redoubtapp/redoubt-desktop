import { create } from 'zustand'
import type { Emoji } from '@/types/api'
import { getApiClient } from '@/lib/api'

interface EmojiState {
  emoji: Emoji[]
  categories: string[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null

  // Actions
  loadEmoji: (instanceId: string) => Promise<void>
  searchEmoji: (query: string) => Emoji[]
  isValidEmoji: (emoji: string) => boolean
}

export const useEmojiStore = create<EmojiState>((set, get) => ({
  emoji: [],
  categories: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  loadEmoji: async (instanceId: string) => {
    const { isLoaded, isLoading } = get()
    if (isLoaded || isLoading) return

    set({ isLoading: true, error: null })

    try {
      const apiClient = getApiClient(instanceId)
      const response = await apiClient.listEmoji()

      // Extract unique categories in order
      const categorySet = new Set<string>()
      response.emoji.forEach((e) => categorySet.add(e.category))
      const categories = Array.from(categorySet)

      set({
        emoji: response.emoji,
        categories,
        isLoading: false,
        isLoaded: true,
      })
    } catch (error) {
      set({
        error: 'Failed to load emoji',
        isLoading: false,
      })
    }
  },

  searchEmoji: (query: string) => {
    const { emoji } = get()
    const lowerQuery = query.toLowerCase()
    return emoji
      .filter((e) => e.name.toLowerCase().includes(lowerQuery))
      .slice(0, 8) // Limit to 8 suggestions
  },

  isValidEmoji: (emojiChar: string) => {
    const { emoji } = get()
    return emoji.some((e) => e.emoji === emojiChar)
  },
}))
