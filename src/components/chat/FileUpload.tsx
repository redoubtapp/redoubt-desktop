import { useRef, useCallback } from 'react'
import { Paperclip, X, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_FILES = 10

interface PendingFile {
  id: string
  file: File
  preview?: string
  isImage: boolean
}

interface FileUploadProps {
  files: PendingFile[]
  onFilesChange: (files: PendingFile[]) => void
  disabled?: boolean
}

export function FileUpload({ files, onFilesChange, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (selectedFiles.length === 0) return

      // Filter and validate files
      const newFiles: PendingFile[] = []
      for (const file of selectedFiles) {
        if (files.length + newFiles.length >= MAX_FILES) {
          break
        }
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`File ${file.name} is too large (max 25MB)`)
          continue
        }

        const isImage = file.type.startsWith('image/')
        const pendingFile: PendingFile = {
          id: crypto.randomUUID(),
          file,
          isImage,
        }

        // Create preview for images
        if (isImage) {
          pendingFile.preview = URL.createObjectURL(file)
        }

        newFiles.push(pendingFile)
      }

      onFilesChange([...files, ...newFiles])
      // Reset input so the same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    [files, onFilesChange]
  )

  const handleRemoveFile = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      onFilesChange(files.filter((f) => f.id !== id))
    },
    [files, onFilesChange]
  )

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {/* Upload button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleClick}
        disabled={disabled || files.length >= MAX_FILES}
        title={`Attach files (${files.length}/${MAX_FILES})`}
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {/* File previews */}
      {files.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-zinc-800 border border-zinc-700 rounded-lg flex flex-wrap gap-2">
          {files.map((pendingFile) => (
            <div
              key={pendingFile.id}
              className={cn(
                'relative group rounded-lg border border-zinc-600 bg-zinc-900',
                pendingFile.isImage ? 'w-20 h-20' : 'flex items-center gap-2 px-3 py-2'
              )}
            >
              {pendingFile.isImage && pendingFile.preview ? (
                <img
                  src={pendingFile.preview}
                  alt={pendingFile.file.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <>
                  <FileIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-zinc-200 truncate max-w-[120px]">
                      {pendingFile.file.name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatFileSize(pendingFile.file.size)}
                    </span>
                  </div>
                </>
              )}

              {/* Remove button */}
              <button
                onClick={() => handleRemoveFile(pendingFile.id)}
                className={cn(
                  'absolute bg-zinc-950/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
                  pendingFile.isImage ? '-top-2 -right-2' : 'top-1 right-1'
                )}
              >
                <X className="h-3.5 w-3.5 text-zinc-300" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export type { PendingFile }
