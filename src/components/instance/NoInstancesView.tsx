import { useState, useEffect } from "react"
import { Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddInstanceDialog } from "./AddInstanceDialog"

export function NoInstancesView() {
  const [dialogOpen, setDialogOpen] = useState(false)

  // Auto-open dialog when this view is first shown
  useEffect(() => {
    setDialogOpen(true)
  }, [])

  return (
    <div className="flex h-svh flex-col items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Server className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Welcome to Redoubt</h1>
        <p className="mt-2 text-muted-foreground">
          Connect to a Redoubt server to get started. You can add multiple
          servers and switch between them at any time.
        </p>
        <Button
          variant="brand"
          className="mt-6"
          onClick={() => setDialogOpen(true)}
        >
          Add Server Instance
        </Button>
      </div>

      <AddInstanceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
