import { useState } from 'react'
import { FileIcon, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getApiClient } from '@/lib/api'
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage'
import { ImageLightbox } from './ImageLightbox'
import type { Attachment } from '@/types/api'

interface AttachmentPreviewProps {
  instanceId: string
  attachments: Attachment[]
}

export function AttachmentPreview({ instanceId, attachments }: AttachmentPreviewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const images = attachments.filter((a) => a.is_image)
  const files = attachments.filter((a) => !a.is_image)

  const handleImageClick = (index: number) => {
    setLightboxIndex(index)
  }

  const handleCloseLightbox = () => {
    setLightboxIndex(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Image grid */}
      {images.length > 0 && (
        <div
          className={cn(
            'grid gap-2',
            images.length === 1 && 'grid-cols-1 max-w-md',
            images.length === 2 && 'grid-cols-2 max-w-lg',
            images.length >= 3 && 'grid-cols-3 max-w-xl'
          )}
        >
          {images.map((attachment, index) => (
            <ImageAttachment
              key={attachment.id}
              instanceId={instanceId}
              attachment={attachment}
              onClick={() => handleImageClick(index)}
              isSingle={images.length === 1}
            />
          ))}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((attachment) => (
            <FileAttachment
              key={attachment.id}
              instanceId={instanceId}
              attachment={attachment}
              formatFileSize={formatFileSize}
            />
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <ImageLightbox
          instanceId={instanceId}
          images={images}
          currentIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}

interface ImageAttachmentProps {
  instanceId: string
  attachment: Attachment
  onClick?: () => void
  isSingle?: boolean
}

function ImageAttachment({ instanceId, attachment, onClick, isSingle }: ImageAttachmentProps) {
  const { url: imageUrl, isLoading, hasError } = useAuthenticatedImage(instanceId, attachment.id)

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden bg-zinc-900 cursor-pointer group',
        isSingle ? 'max-h-96' : 'aspect-square'
      )}
      onClick={onClick}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
        </div>
      )}

      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
          <FileIcon className="h-8 w-8 mb-1" />
          <span className="text-xs">Failed to load</span>
        </div>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={attachment.filename}
          className={cn(
            'w-full h-full transition-opacity',
            isSingle ? 'object-contain' : 'object-cover',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
        />
      ) : null}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <ExternalLink className="h-6 w-6 text-white drop-shadow-lg" />
      </div>

      {/* Filename tooltip */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-white truncate block">{attachment.filename}</span>
      </div>
    </div>
  )
}

interface FileAttachmentProps {
  instanceId: string
  attachment: Attachment
  formatFileSize: (bytes: number) => string
}

function FileAttachment({ instanceId, attachment, formatFileSize }: FileAttachmentProps) {
  const handleDownload = () => {
    const apiClient = getApiClient(instanceId)
    apiClient.downloadAttachment(attachment.id, attachment.filename)
  }

  // Get file extension for icon styling
  const extension = attachment.filename.split('.').pop()?.toLowerCase() || ''

  const getExtensionColor = (ext: string): string => {
    const colors: Record<string, string> = {
      pdf: 'text-red-400',
      doc: 'text-blue-400',
      docx: 'text-blue-400',
      xls: 'text-green-400',
      xlsx: 'text-green-400',
      zip: 'text-yellow-400',
      rar: 'text-yellow-400',
      txt: 'text-zinc-400',
      json: 'text-orange-400',
      js: 'text-yellow-400',
      ts: 'text-blue-400',
      py: 'text-green-400',
      go: 'text-cyan-400',
    }
    return colors[ext] || 'text-zinc-400'
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors group">
      <FileIcon className={cn('h-5 w-5 flex-shrink-0', getExtensionColor(extension))} />

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-zinc-200 truncate max-w-[200px]">
          {attachment.filename}
        </span>
        <span className="text-xs text-zinc-500">
          {formatFileSize(attachment.size_bytes)}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDownload}
        title="Download"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  )
}
