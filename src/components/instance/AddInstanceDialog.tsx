import { useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  useInstanceStore,
  validateRedoubtServer,
  normalizeUrl,
} from "@/store/instanceStore"
import type { ServerInfo } from "@/types/instance"

interface AddInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddInstanceDialog({ open, onOpenChange }: AddInstanceDialogProps) {
  const [url, setUrl] = useState("")
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addInstance, setActiveInstance } = useInstanceStore()

  const resetForm = () => {
    setUrl("")
    setServerInfo(null)
    setError(null)
    setIsChecking(false)
    setIsAdding(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const handleCheck = async () => {
    if (!url.trim()) return

    setIsChecking(true)
    setError(null)
    setServerInfo(null)

    try {
      const info = await validateRedoubtServer(url)
      setServerInfo(info)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to server")
    } finally {
      setIsChecking(false)
    }
  }

  const handleAdd = async () => {
    if (!serverInfo) return

    setIsAdding(true)
    setError(null)

    try {
      const instance = await addInstance(url)
      setActiveInstance(instance.id)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add instance")
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !serverInfo && url.trim() && !isChecking) {
      handleCheck()
    }
  }

  const normalizedUrl = url.trim() ? normalizeUrl(url) : ""

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Server Instance</DialogTitle>
          <DialogDescription>
            Enter the URL of a Redoubt server to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://redoubt.example.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setServerInfo(null)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={isChecking || isAdding || !!serverInfo}
            />
            {!serverInfo && (
              <Button
                onClick={handleCheck}
                disabled={!url.trim() || isChecking}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking
                  </>
                ) : (
                  "Check"
                )}
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {serverInfo && (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Avatar className="h-10 w-10">
                {serverInfo.iconUrl && (
                  <AvatarImage src={serverInfo.iconUrl} alt="" />
                )}
                <AvatarFallback className="bg-muted">
                  {serverInfo.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{serverInfo.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {normalizedUrl}
                </p>
                {serverInfo.version !== "unknown" && (
                  <p className="text-xs text-muted-foreground">
                    v{serverInfo.version}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {serverInfo ? (
            <Button variant="brand" onClick={handleAdd} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding
                </>
              ) : (
                "Add Instance"
              )}
            </Button>
          ) : (
            <Button
              variant="brand"
              onClick={handleCheck}
              disabled={!url.trim() || isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking
                </>
              ) : (
                "Check Server"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
