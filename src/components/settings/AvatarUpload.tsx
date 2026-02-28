import { useState, useRef, useCallback } from 'react'
import { useStore } from 'zustand'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'
import { getApiClient } from '@/lib/api'
import { authStores } from '@/store/authStore'
import { invalidateAvatarCache } from '@/hooks/useAuthenticatedAvatar'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

interface AvatarUploadProps {
  instanceId: string
}

export function AvatarUpload({ instanceId }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const authStore = authStores.get(instanceId)
  const user = useStore(authStore, (s) => s.user)
  const setUser = useStore(authStore, (s) => s.setUser)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !user) return

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = ''
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Please upload a PNG, JPEG, WebP, or GIF image')
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError('Image must be less than 5MB')
        return
      }

      setError(null)
      setIsUploading(true)

      try {
        const apiClient = getApiClient(instanceId)
        const response = await apiClient.uploadAvatar(file)
        // Invalidate cache for the user's avatar
        invalidateAvatarCache(instanceId, user.id)
        // Update user state with new avatar URL
        setUser({ ...user, avatar_url: response.avatar_url })
      } catch (err) {
        console.error('Failed to upload avatar:', err)
        setError('Failed to upload avatar. Please try again.')
      } finally {
        setIsUploading(false)
      }
    },
    [user, setUser, instanceId]
  )

  const handleDelete = useCallback(async () => {
    if (!user) return

    setError(null)
    setIsDeleting(true)

    try {
      const apiClient = getApiClient(instanceId)
      await apiClient.deleteAvatar()
      // Invalidate cache
      invalidateAvatarCache(instanceId, user.id)
      // Update user state
      setUser({ ...user, avatar_url: undefined })
    } catch (err) {
      console.error('Failed to delete avatar:', err)
      setError('Failed to delete avatar. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }, [user, setUser, instanceId])

  if (!user) return null

  const hasAvatar = Boolean(user.avatar_url)
  const isLoading = isUploading || isDeleting

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative group">
          <UserAvatar
            instanceId={instanceId}
            userId={user.id}
            username={user.username}
            avatarUrl={user.avatar_url}
            size="lg"
            className="h-20 w-20"
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileSelect}
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={isLoading}
          >
            <Camera className="h-4 w-4 mr-2" />
            {hasAvatar ? 'Change Avatar' : 'Upload Avatar'}
          </Button>
          {hasAvatar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Avatar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Supported formats: PNG, JPEG, WebP, GIF. Maximum size: 5MB.
      </p>
    </div>
  )
}
