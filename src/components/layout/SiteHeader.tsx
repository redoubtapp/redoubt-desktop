import { useStore } from 'zustand'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { spaceStores } from '@/store/spaceStore'

interface SiteHeaderProps {
  instanceId: string
}

export function SiteHeader({ instanceId }: SiteHeaderProps) {
  const spaceStore = spaceStores.get(instanceId)
  const channels = useStore(spaceStore, (s) => s.channels)
  const currentChannelId = useStore(spaceStore, (s) => s.currentChannelId)
  const currentChannel = channels.find((c) => c.id === currentChannelId)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>
              {currentChannel ? `# ${currentChannel.name}` : 'Select a channel'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
