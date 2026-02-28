import { useState, useEffect, useCallback } from 'react'
import { useStore } from 'zustand'
import { Copy, Check, Trash2, Plus, Loader2, Link } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { getApiClient } from '@/lib/api'
import { spaceStores } from '@/store/spaceStore'
import type { InviteResponse } from '@/types/api'

interface InviteMembersDialogProps {
  instanceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteMembersDialog({
  instanceId,
  open,
  onOpenChange,
}: InviteMembersDialogProps) {
  const [invites, setInvites] = useState<InviteResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Create invite form state
  const [maxUses, setMaxUses] = useState<string>('')
  const [expiresInHours, setExpiresInHours] = useState<string>('24')

  const spaceStore = spaceStores.get(instanceId)
  const currentSpaceId = useStore(spaceStore, (s) => s.currentSpaceId)

  const loadInvites = useCallback(async () => {
    if (!currentSpaceId) return

    setIsLoading(true)
    setError(null)
    try {
      const apiClient = getApiClient(instanceId)
      const response = await apiClient.listSpaceInvites(currentSpaceId)
      setInvites(response.invites)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites')
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, currentSpaceId])

  useEffect(() => {
    if (open && currentSpaceId) {
      loadInvites()
    }
  }, [open, currentSpaceId, loadInvites])

  const handleCreateInvite = async () => {
    if (!currentSpaceId) return

    setIsCreating(true)
    setError(null)
    try {
      const apiClient = getApiClient(instanceId)
      const invite = await apiClient.createInvite(currentSpaceId, {
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
        expires_in_hours: expiresInHours && expiresInHours !== 'never' ? parseInt(expiresInHours, 10) : undefined,
      })
      setInvites((prev) => [invite, ...prev])
      setMaxUses('')
      setExpiresInHours('24')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const apiClient = getApiClient(instanceId)
      await apiClient.revokeInvite(inviteId)
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    }
  }

  const copyInviteLink = async (code: string, inviteId: string) => {
    const link = `${window.location.origin}/join/${code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(inviteId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedId(inviteId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const copyInviteCode = async (code: string, inviteId: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(inviteId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedId(inviteId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return 'Never'
    const date = new Date(expiresAt)
    const now = new Date()
    if (date < now) return 'Expired'
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h`
    const minutes = Math.floor(diff / (1000 * 60))
    return `${minutes}m`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Create invite links to add new members to this space.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new invite form */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Create New Invite</Label>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="max-uses" className="text-xs text-muted-foreground">
                  Max Uses
                </Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="expires" className="text-xs text-muted-foreground">
                  Expires In
                </Label>
                <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                  <SelectTrigger id="expires">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCreateInvite}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invite Link
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Separator />

          {/* Existing invites */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Invites</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : invites.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No active invites. Create one above.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono truncate">
                          {invite.code}
                        </code>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>
                          Uses: {invite.uses}
                          {invite.max_uses ? `/${invite.max_uses}` : ''}
                        </span>
                        <span>Expires: {formatExpiry(invite.expires_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyInviteCode(invite.code, invite.id)}
                        title="Copy invite code"
                      >
                        {copiedId === invite.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyInviteLink(invite.code, invite.id)}
                        title="Copy invite link"
                      >
                        <Link className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRevokeInvite(invite.id)}
                        title="Revoke invite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
