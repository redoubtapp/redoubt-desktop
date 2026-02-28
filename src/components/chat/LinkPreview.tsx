import { useState, useEffect } from 'react'
import { X, ExternalLink, Loader2 } from 'lucide-react'
import { useLinkPreviewStore } from '@/store/linkPreviewStore'
import { useInstanceStore } from '@/store/instanceStore'
import type { OpenGraphMetadata } from '@/types/api'

interface LinkPreviewProps {
  url: string
  messageId: string
}

export function LinkPreview({ url, messageId }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<OpenGraphMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [imageError, setImageError] = useState(false)

  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)!
  const fetchMetadata = useLinkPreviewStore((s) => s.fetchMetadata)
  const dismissPreview = useLinkPreviewStore((s) => s.dismissPreview)
  const isDismissed = useLinkPreviewStore((s) => s.isDismissed)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setHasError(false)

      try {
        const data = await fetchMetadata(activeInstanceId, url)
        if (!cancelled) {
          setMetadata(data)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setHasError(true)
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [url, fetchMetadata, activeInstanceId])

  // Don't render if dismissed
  if (isDismissed(messageId, url)) {
    return null
  }

  // Don't render while loading
  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading preview...
      </div>
    )
  }

  // Don't render on error or if no meaningful data
  if (hasError || !metadata || (!metadata.title && !metadata.description)) {
    return null
  }

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  })()

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dismissPreview(messageId, url)
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block max-w-md rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 transition-colors overflow-hidden group"
    >
      <div className="relative">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 p-1 rounded bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Dismiss preview"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        {metadata.image && !imageError && (
          <div className="relative w-full h-32 bg-zinc-900">
            <img
              src={metadata.image}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          {/* Site info */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            {metadata.favicon && (
              <img
                src={metadata.favicon}
                alt=""
                className="w-4 h-4"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <span>{metadata.site_name || hostname}</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </div>

          {/* Title */}
          {metadata.title && (
            <h4 className="text-sm font-medium text-zinc-200 line-clamp-2">
              {metadata.title}
            </h4>
          )}

          {/* Description */}
          {metadata.description && (
            <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
              {metadata.description}
            </p>
          )}
        </div>
      </div>
    </a>
  )
}
