import { useState, useEffect } from 'react'
import { getApiClient } from '@/lib/api'

interface UseAuthenticatedImageResult {
  url: string | null
  isLoading: boolean
  hasError: boolean
}

// Cache for blob URLs to avoid refetching (keyed by instanceId:attachmentId)
const blobUrlCache = new Map<string, string>()

export function useAuthenticatedImage(instanceId: string, attachmentId: string): UseAuthenticatedImageResult {
  const cacheKey = `${instanceId}:${attachmentId}`
  const [url, setUrl] = useState<string | null>(() => blobUrlCache.get(cacheKey) || null)
  const [isLoading, setIsLoading] = useState(!blobUrlCache.has(cacheKey))
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const key = `${instanceId}:${attachmentId}`

    // Already cached
    if (blobUrlCache.has(key)) {
      setUrl(blobUrlCache.get(key)!)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const fetchImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)
        const apiClient = getApiClient(instanceId)
        const blob = await apiClient.fetchAttachmentBlob(attachmentId)

        if (cancelled) return

        const blobUrl = URL.createObjectURL(blob)
        blobUrlCache.set(key, blobUrl)
        setUrl(blobUrl)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load image:', error)
        setHasError(true)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchImage()

    return () => {
      cancelled = true
    }
  }, [instanceId, attachmentId])

  return { url, isLoading, hasError }
}

// Cleanup function to revoke blob URLs when needed (e.g., on logout)
export function clearImageCache() {
  blobUrlCache.forEach((url) => URL.revokeObjectURL(url))
  blobUrlCache.clear()
}
