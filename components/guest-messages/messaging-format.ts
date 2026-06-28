export function formatConversationTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const today = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  if (today) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  if (isYesterday) return 'Yesterday'
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays < 7) {
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function groupMessagesByDay<T extends { createdAt: string }>(
  messages: T[],
): { label: string; messages: T[] }[] {
  const groups: { label: string; messages: T[] }[] = []
  let currentLabel: string | null = null

  for (const message of messages) {
    const label = formatDayLabel(message.createdAt)
    if (label !== currentLabel) {
      groups.push({ label, messages: [message] })
      currentLabel = label
    } else {
      groups[groups.length - 1].messages.push(message)
    }
  }

  return groups
}
