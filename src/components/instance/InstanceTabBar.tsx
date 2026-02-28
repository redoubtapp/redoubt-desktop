import { useState } from "react"
import { Plus, X } from "lucide-react"
import { useInstanceStore } from "@/store/instanceStore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import { AddInstanceDialog } from "./AddInstanceDialog"
import { RemoveInstanceDialog } from "./RemoveInstanceDialog"
import type { Instance } from "@/types/instance"

interface InstanceTabProps {
  instance: Instance
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}

function InstanceTab({ instance, isActive, onSelect, onRemove }: InstanceTabProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className={cn(
            "group relative flex h-8 items-center gap-2 rounded-md px-3 text-sm transition-colors",
            "hover:bg-accent",
            isActive && "bg-accent"
          )}
          onClick={onSelect}
        >
          <Avatar className="h-5 w-5">
            {instance.iconUrl && <AvatarImage src={instance.iconUrl} alt="" />}
            <AvatarFallback className="text-xs bg-muted">
              {instance.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-24 truncate">{instance.name}</span>
          <span
            role="button"
            tabIndex={0}
            className={cn(
              "ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted cursor-pointer",
              "group-hover:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation()
                onRemove()
              }
            }}
          >
            <X className="h-3 w-3" />
          </span>
          {isActive && (
            <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand" />
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem variant="destructive" onClick={onRemove}>
          Remove Instance
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function InstanceTabBar() {
  const { instances, activeInstanceId, setActiveInstance } = useInstanceStore()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [removeInstance, setRemoveInstance] = useState<Instance | null>(null)

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-2">
      <div className="flex items-center gap-1">
        {instances.map((instance) => (
          <InstanceTab
            key={instance.id}
            instance={instance}
            isActive={instance.id === activeInstanceId}
            onSelect={() => setActiveInstance(instance.id)}
            onRemove={() => setRemoveInstance(instance)}
          />
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setAddDialogOpen(true)}
        title="Add instance"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <AddInstanceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {removeInstance && (
        <RemoveInstanceDialog
          instance={removeInstance}
          open={!!removeInstance}
          onOpenChange={(open) => !open && setRemoveInstance(null)}
        />
      )}
    </div>
  )
}
