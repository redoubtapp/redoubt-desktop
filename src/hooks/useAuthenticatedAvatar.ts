import { useState, useEffect } from 'react'
import { getApiClient } from '@/lib/api'

interface UseAuthenticatedAvatarResult {
  url: string | null
  isLoading: boolean
  hasError: boolean
}

// Cache for avatar blob URLs (keyed by instanceId:userId)
const avatarCache = new Map<string, string>()

// Version counter for cache invalidation
let cacheVersion = 0

export function useAuthenticatedAvatar(
  instanceId: string | undefined,
  userId: string | undefined,
  hasAvatar: boolean
): UseAuthenticatedAvatarResult {
  const cacheKey = instanceId && userId ? `${instanceId}:${userId}` : undefined
  const [url, setUrl] = useState<string | null>(() =>
    cacheKey && hasAvatar ? avatarCache.get(cacheKey) || null : null
  )
  const [isLoading, setIsLoading] = useState(cacheKey ? hasAvatar && !avatarCache.has(cacheKey) : false)
  const [hasError, setHasError] = useState(false)
  const [version] = useState(cacheVersion)

  useEffect(() => {
    // No instance, user, or no avatar
    if (!instanceId || !userId || !hasAvatar) {
      setUrl(null)
      setIsLoading(false)
      setHasError(false)
      return
    }

    const key = `${instanceId}:${userId}`

    // Already cached and cache not invalidated
    if (avatarCache.has(key) && version === cacheVersion) {
      setUrl(avatarCache.get(key)!)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const fetchAvatar = async () => {
      try {
        setIsLoading(true)
        setHasError(false)
        const apiClient = getApiClient(instanceId)
        const blob = await apiClient.fetchAvatarBlob(userId)

        if (cancelled) return

        const blobUrl = URL.createObjectURL(blob)
        avatarCache.set(key, blobUrl)
        setUrl(blobUrl)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load avatar:', error)
        setHasError(true)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchAvatar()

    return () => {
      cancelled = true
    }
  }, [instanceId, userId, hasAvatar, version])

  return { url, isLoading, hasError }
}

// Invalidate cache for a specific user (call after avatar upload/delete)
export function invalidateAvatarCache(instanceId: string, userId: string) {
  const key = `${instanceId}:${userId}`
  const oldUrl = avatarCache.get(key)
  if (oldUrl) {
    URL.revokeObjectURL(oldUrl)
    avatarCache.delete(key)
  }
  cacheVersion++
}

// Clear all avatar cache (e.g., on logout)
export function clearAvatarCache() {
  avatarCache.forEach((url) => URL.revokeObjectURL(url))
  avatarCache.clear()
  cacheVersion++
}
