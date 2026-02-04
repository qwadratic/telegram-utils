import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Message } from '@mtcute/node'
import { sanitizeFilename } from '../utils/filename.js'
import { formatMessage } from './format.js'

/**
 * Sort messages oldest-first (chronological).
 */
function sortMessagesChronological(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const timeDiff = a.date.getTime() - b.date.getTime()
    if (timeDiff !== 0) return timeDiff
    return a.id - b.id
  })
}

/**
 * Create YAML frontmatter for a chat archive file.
 *
 * @param chatName - Display name of the chat
 * @param chatId - Numeric chat ID
 * @param firstMsgId - ID of the first (oldest) message in this file
 * @param lastMsgId - ID of the last (newest) message in this file
 * @param messageCount - Total messages in this file
 * @param minDate - Earliest message date (ISO 8601)
 * @param maxDate - Latest message date (ISO 8601)
 * @returns YAML frontmatter string including the trailing newlines
 */
export function createFrontmatter(
  chatName: string,
  chatId: number,
  firstMsgId: number,
  lastMsgId: number,
  messageCount: number,
  minDate: string,
  maxDate: string
): string {
  const now = new Date().toISOString()
  // Escape quotes in chat name with backslash
  const escapedName = chatName.replace(/"/g, '\\"')

  return `---
chat_name: "${escapedName}"
chat_id: ${chatId}
first_message_id: ${firstMsgId}
last_message_id: ${lastMsgId}
message_count: ${messageCount}
min_date: "${minDate}"
max_date: "${maxDate}"
exported_at: "${now}"
---

`
}

/**
 * Create YAML frontmatter for an empty chat archive file.
 */
function createEmptyFrontmatter(chatName: string, chatId: number): string {
  const now = new Date().toISOString()
  const escapedName = chatName.replace(/"/g, '\\"')

  return `---
chat_name: "${escapedName}"
chat_id: ${chatId}
first_message_id: null
last_message_id: null
message_count: 0
min_date: null
max_date: null
exported_at: "${now}"
---

`
}

/**
 * Write messages to a single chat archive file.
 *
 * Creates files at: data/archive/{sanitized-chat-name}.md
 *
 * Each file contains:
 * - YAML frontmatter with chat metadata
 * - Formatted messages in chronological order (oldest first)
 *
 * @param chatName - Display name of the chat
 * @param chatId - Numeric chat ID
 * @param messages - Array of messages to write (can be in any order)
 * @returns Counts of files and messages written
 */
export async function writeChatFile(
  chatName: string,
  chatId: number,
  messages: Message[]
): Promise<{ filesWritten: number; messagesWritten: number }> {
  // Create an empty file if no messages
  if (messages.length === 0) {
    const safeFilename = sanitizeFilename(chatName, chatId)
    const dirPath = join('data', 'archive')
    mkdirSync(dirPath, { recursive: true })
    const filePath = join(dirPath, `${safeFilename}.md`)
    const content = `${createEmptyFrontmatter(chatName, chatId)}No messages.\n`
    writeFileSync(filePath, content, 'utf-8')
    return { filesWritten: 1, messagesWritten: 0 }
  }

  const orderedMessages = sortMessagesChronological(messages)

  // Sanitize chat name for filesystem
  const safeFilename = sanitizeFilename(chatName, chatId)

  const dirPath = join('data', 'archive')
  mkdirSync(dirPath, { recursive: true })
  const filePath = join(dirPath, `${safeFilename}.md`)

  const firstMsgId = orderedMessages[0].id
  const lastMsgId = orderedMessages[orderedMessages.length - 1].id
  const minDate = orderedMessages[0].date.toISOString()
  const maxDate = orderedMessages[orderedMessages.length - 1].date.toISOString()

  let content = createFrontmatter(
    chatName,
    chatId,
    firstMsgId,
    lastMsgId,
    orderedMessages.length,
    minDate,
    maxDate
  )

  for (const msg of orderedMessages) {
    content += formatMessage(msg)
  }

  writeFileSync(filePath, content, 'utf-8')

  return { filesWritten: 1, messagesWritten: orderedMessages.length }
}

/**
 * Write a combined archive file in data/archive.
 */
export function writeCombinedArchiveFile(
  fileName: string,
  content: string
): string {
  const dirPath = join('data', 'archive')
  mkdirSync(dirPath, { recursive: true })
  const filePath = join(dirPath, fileName)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}
