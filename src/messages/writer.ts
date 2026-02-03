import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Message } from '@mtcute/node'
import { sanitizeFilename } from '../utils/filename.js'
import { formatMessage } from './format.js'

/**
 * Extract YYYY-MM key from a Date object.
 */
function getYearMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Group messages by month (YYYY-MM).
 *
 * Messages within each group are sorted oldest-first (reversed from API order).
 *
 * @param messages - Array of messages to group (typically newest-first from API)
 * @returns Map with YYYY-MM keys and arrays of messages sorted oldest-first
 */
export function groupByMonth(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>()

  for (const msg of messages) {
    const key = getYearMonth(msg.date)
    const group = groups.get(key) || []
    group.push(msg)
    groups.set(key, group)
  }

  // Reverse each group so messages are oldest-first (chronological)
  for (const [key, group] of groups) {
    groups.set(key, group.reverse())
  }

  return groups
}

/**
 * Create YAML frontmatter for a monthly archive file.
 *
 * @param chatName - Display name of the chat
 * @param chatId - Numeric chat ID
 * @param firstMsgId - ID of the first (oldest) message in this file
 * @param lastMsgId - ID of the last (newest) message in this file
 * @returns YAML frontmatter string including the trailing newlines
 */
export function createFrontmatter(
  chatName: string,
  chatId: number,
  firstMsgId: number,
  lastMsgId: number
): string {
  const now = new Date().toISOString()
  // Escape quotes in chat name with backslash
  const escapedName = chatName.replace(/"/g, '\\"')

  return `---
chat_name: "${escapedName}"
chat_id: ${chatId}
first_message_id: ${firstMsgId}
last_message_id: ${lastMsgId}
exported_at: "${now}"
---

`
}

/**
 * Write messages to monthly archive files.
 *
 * Creates files at: archive/YYYY-MM/{sanitized-chat-name}.md
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
export async function writeMonthlyFiles(
  chatName: string,
  chatId: number,
  messages: Message[]
): Promise<{ filesWritten: number; messagesWritten: number }> {
  // Skip if no messages
  if (messages.length === 0) {
    return { filesWritten: 0, messagesWritten: 0 }
  }

  // Group messages by month
  const grouped = groupByMonth(messages)

  // Sanitize chat name for filesystem
  const safeFilename = sanitizeFilename(chatName, chatId)

  let filesWritten = 0
  let messagesWritten = 0

  for (const [yearMonth, monthMessages] of grouped) {
    // Create directory if needed
    const dirPath = join('archive', yearMonth)
    mkdirSync(dirPath, { recursive: true })

    // Build file path
    const filePath = join(dirPath, `${safeFilename}.md`)

    // Get first and last message IDs (messages are now sorted oldest-first)
    const firstMsgId = monthMessages[0].id
    const lastMsgId = monthMessages[monthMessages.length - 1].id

    // Build file content
    let content = createFrontmatter(chatName, chatId, firstMsgId, lastMsgId)

    for (const msg of monthMessages) {
      content += formatMessage(msg)
    }

    // Write file
    writeFileSync(filePath, content, 'utf-8')

    filesWritten++
    messagesWritten += monthMessages.length
  }

  return { filesWritten, messagesWritten }
}
