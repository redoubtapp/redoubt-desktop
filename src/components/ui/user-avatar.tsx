import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthenticatedAvatar } from '@/hooks/useAuthenticatedAvatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  instanceId: string
  userId: string
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function UserAvatar({
  instanceId,
  userId,
  username,
  avatarUrl,
  size = 'default',
  className,
}: UserAvatarProps) {
  const hasAvatar = Boolean(avatarUrl)
  const { url, isLoading } = useAuthenticatedAvatar(instanceId, userId, hasAvatar)
  const [imageError, setImageError] = useState(false)

  const initials = username.slice(0, 2).toUpperCase()

  // Show fallback if: loading, no URL, or image failed to load
  const showFallback = isLoading || !url || imageError

  return (
    <Avatar size={size} className={className}>
      {url && !imageError && (
        <img
          src={url}
          alt={username}
          className="aspect-square size-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
      {showFallback && (
        <AvatarFallback>
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className={cn(
                  'border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin',
                  size === 'sm' && 'w-3 h-3',
                  size === 'default' && 'w-4 h-4',
                  size === 'lg' && 'w-5 h-5'
                )}
              />
            </div>
          ) : (
            initials
          )}
        </AvatarFallback>
      )}
    </Avatar>
  )
}
