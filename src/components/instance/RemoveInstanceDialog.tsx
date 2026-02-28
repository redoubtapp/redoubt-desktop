import { useState } from "react"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { useInstanceStore } from "@/store/instanceStore"
import type { Instance } from "@/types/instance"

interface RemoveInstanceDialogProps {
  instance: Instance
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RemoveInstanceDialog({
  instance,
  open,
  onOpenChange,
}: RemoveInstanceDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const { removeInstance } = useInstanceStore()

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await removeInstance(instance.id)
      onOpenChange(false)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Instance</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{instance.name}</strong>?
            This will sign you out and remove all local data for this instance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={isRemoving}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isRemoving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removing
              </>
            ) : (
              "Remove"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
