import type { Message } from '@mtcute/node'

/**
 * Sort messages oldest-first (chronological).
 */
export function sortMessagesChronological(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const timeDiff = a.date.getTime() - b.date.getTime()
    if (timeDiff !== 0) return timeDiff
    return a.id - b.id
  })
}
