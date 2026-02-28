import { Wifi, WifiOff } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ConnectionQualityProps {
  quality: 'excellent' | 'good' | 'poor' | 'unknown'
  className?: string
}

export function ConnectionQuality({ quality, className }: ConnectionQualityProps) {
  const getQualityColor = () => {
    switch (quality) {
      case 'excellent':
        return 'text-green-500'
      case 'good':
        return 'text-yellow-500'
      case 'poor':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  const getQualityLabel = () => {
    switch (quality) {
      case 'excellent':
        return 'Excellent connection'
      case 'good':
        return 'Good connection'
      case 'poor':
        return 'Poor connection'
      default:
        return 'Connection quality unknown'
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('cursor-default', getQualityColor(), className)}>
          {quality === 'poor' ? (
            <WifiOff className="h-4 w-4" />
          ) : (
            <Wifi className="h-4 w-4" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{getQualityLabel()}</TooltipContent>
    </Tooltip>
  )
}
