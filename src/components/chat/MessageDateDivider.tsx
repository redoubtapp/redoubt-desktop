interface MessageDateDividerProps {
  date: string
}

export function MessageDateDivider({ date }: MessageDateDividerProps) {
  const formatDate = (dateStr: string) => {
    const dateObj = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today.toLocaleDateString()) {
      return 'Today'
    }
    if (dateStr === yesterday.toLocaleDateString()) {
      return 'Yesterday'
    }
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 h-px bg-zinc-700" />
      <span className="text-xs text-zinc-500 font-medium">{formatDate(date)}</span>
      <div className="flex-1 h-px bg-zinc-700" />
    </div>
  )
}
