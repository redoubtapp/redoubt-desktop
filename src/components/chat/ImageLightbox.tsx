import { useEffect, useCallback } from 'react'
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApiClient } from '@/lib/api'
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage'
import type { Attachment } from '@/types/api'

interface ImageLightboxProps {
  instanceId: string
  images: Attachment[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function ImageLightbox({
  instanceId,
  images,
  currentIndex,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const currentImage = images[currentIndex]
  const hasMultiple = images.length > 1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < images.length - 1

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1)
    }
  }, [hasPrev, currentIndex, onNavigate])

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1)
    }
  }, [hasNext, currentIndex, onNavigate])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    },
    [onClose, handlePrev, handleNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleDownload = () => {
    const apiClient = getApiClient(instanceId)
    apiClient.downloadAttachment(currentImage.id, currentImage.filename)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <div className="text-white">
          <span className="text-sm font-medium">{currentImage.filename}</span>
          {hasMultiple && (
            <span className="text-sm text-zinc-400 ml-2">
              ({currentIndex + 1} of {images.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/20"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/20"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 h-12 w-12 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={handlePrev}
            disabled={!hasPrev}
            title="Previous (Left arrow)"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 h-12 w-12 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={handleNext}
            disabled={!hasNext}
            title="Next (Right arrow)"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Image */}
      <LightboxImage
        instanceId={instanceId}
        attachmentId={currentImage.id}
        filename={currentImage.filename}
      />

      {/* Thumbnail strip for multiple images */}
      {hasMultiple && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex justify-center gap-2 overflow-x-auto">
            {images.map((img, index) => (
              <ThumbnailImage
                key={img.id}
                instanceId={instanceId}
                attachmentId={img.id}
                filename={img.filename}
                isActive={index === currentIndex}
                onClick={() => onNavigate(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for main lightbox image
function LightboxImage({ instanceId, attachmentId, filename }: { instanceId: string; attachmentId: string; filename: string }) {
  const { url, isLoading, hasError } = useAuthenticatedImage(instanceId, attachmentId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    )
  }

  if (hasError || !url) {
    return (
      <div className="text-zinc-400 text-center">
        <p>Failed to load image</p>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={filename}
      className="max-w-[90vw] max-h-[85vh] object-contain"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

// Helper component for thumbnail images
function ThumbnailImage({
  instanceId,
  attachmentId,
  filename,
  isActive,
  onClick,
}: {
  instanceId: string
  attachmentId: string
  filename: string
  isActive: boolean
  onClick: () => void
}) {
  const { url, isLoading } = useAuthenticatedImage(instanceId, attachmentId)

  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-colors flex-shrink-0 ${
        isActive ? 'border-white' : 'border-transparent hover:border-white/50'
      }`}
    >
      {isLoading ? (
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
        </div>
      ) : url ? (
        <img src={url} alt={filename} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-zinc-800" />
      )}
    </button>
  )
}
