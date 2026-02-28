import { useStore } from 'zustand'
import { User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { authStores } from '@/store/authStore'
import { AvatarUpload } from './AvatarUpload'

interface UserSettingsProps {
  instanceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserSettings({ instanceId, open, onOpenChange }: UserSettingsProps) {
  const authStore = authStores.get(instanceId)
  const user = useStore(authStore, (s) => s.user)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Info */}
          <div className="space-y-2">
            <Label>Username</Label>
            <p className="text-sm text-foreground">{user?.username}</p>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-sm text-foreground">{user?.email}</p>
          </div>

          <Separator />

          {/* Avatar Section */}
          <div className="space-y-3">
            <Label>Avatar</Label>
            <AvatarUpload instanceId={instanceId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
