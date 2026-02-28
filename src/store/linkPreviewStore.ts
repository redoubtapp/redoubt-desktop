import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpenGraphMetadata } from '@/types/api'
import { getApiClient } from '@/lib/api'

interface LinkPreviewState {
  // Cache of fetched metadata by URL
  metadata: Map<string, OpenGraphMetadata>
  // URLs that are currently being fetched
  loading: Set<string>
  // URLs that the user has dismissed (per message)
  dismissed: Map<string, Set<string>> // messageId -> Set<url>

  // Actions
  fetchMetadata: (instanceId: string, url: string) => Promise<OpenGraphMetadata | null>
  dismissPreview: (messageId: string, url: string) => void
  isDismissed: (messageId: string, url: string) => boolean
}

export const useLinkPreviewStore = create<LinkPreviewState>()(
  persist(
    (set, get) => ({
      metadata: new Map(),
      loading: new Set(),
      dismissed: new Map(),

      fetchMetadata: async (instanceId, url) => {
        const { metadata, loading } = get()

        // Return cached if available
        const cached = metadata.get(url)
        if (cached) return cached

        // Already loading
        if (loading.has(url)) {
          // Wait for existing request
          return new Promise((resolve) => {
            const check = () => {
              const result = get().metadata.get(url)
              if (result) {
                resolve(result)
              } else if (!get().loading.has(url)) {
                resolve(null)
              } else {
                setTimeout(check, 100)
              }
            }
            check()
          })
        }

        // Mark as loading
        set((state) => ({
          loading: new Set(state.loading).add(url),
        }))

        try {
          const apiClient = getApiClient(instanceId)
          const data = await apiClient.fetchOpenGraph(url)

          set((state) => {
            const newMetadata = new Map(state.metadata)
            newMetadata.set(url, data)
            const newLoading = new Set(state.loading)
            newLoading.delete(url)
            return { metadata: newMetadata, loading: newLoading }
          })

          return data
        } catch (error) {
          console.error('Failed to fetch OpenGraph metadata:', error)
          set((state) => {
            const newLoading = new Set(state.loading)
            newLoading.delete(url)
            return { loading: newLoading }
          })
          return null
        }
      },

      dismissPreview: (messageId, url) => {
        set((state) => {
          const newDismissed = new Map(state.dismissed)
          const messageUrls = new Set(newDismissed.get(messageId) || [])
          messageUrls.add(url)
          newDismissed.set(messageId, messageUrls)
          return { dismissed: newDismissed }
        })
      },

      isDismissed: (messageId, url) => {
        const { dismissed } = get()
        return dismissed.get(messageId)?.has(url) ?? false
      },
    }),
    {
      name: 'link-preview-dismissed',
      partialize: (state) => ({
        // Only persist dismissed state, convert Map/Set for JSON
        dismissed: Array.from(state.dismissed.entries()).map(([k, v]) => [
          k,
          Array.from(v),
        ]),
      }),
      merge: (persisted, current) => {
        const dismissed = new Map<string, Set<string>>()
        if (persisted && typeof persisted === 'object' && 'dismissed' in persisted) {
          const data = persisted.dismissed as Array<[string, string[]]>
          for (const [messageId, urls] of data) {
            dismissed.set(messageId, new Set(urls))
          }
        }
        return {
          ...current,
          dismissed,
        }
      },
    }
  )
)
