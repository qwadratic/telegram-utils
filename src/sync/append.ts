import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Message } from '@mtcute/node'
import { formatMessage } from '../messages/format.js'
import { sanitizeFilename } from '../utils/filename.js'

/**
 * Result of appending messages to a monthly file.
 */
export interface AppendResult {
  messagesAppended: number
  fileCreated: boolean
}

/**
 * Get current year-month string in YYYY-MM format.
 */
export function getCurrentYearMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Update frontmatter with new last_message_id and exported_at, then append messages.
 *
 * @param existingContent - Current file content
 * @param newMessages - Formatted messages to append
 * @param newLastMsgId - ID of the last message being appended
 * @returns Updated file content
 */
function updateFrontmatterAndAppend(
  existingContent: string,
  newMessages: string,
  newLastMsgId: number
): string {
  // Match frontmatter block
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/
  const match = existingContent.match(frontmatterRegex)

  if (!match) {
    throw new Error('Invalid file format: no frontmatter found')
  }

  const frontmatter = match[1]
  const body = existingContent.slice(match[0].length)

  // Update last_message_id and exported_at, keep others unchanged
  const updatedFrontmatter = frontmatter
    .replace(/^last_message_id: .+$/m, `last_message_id: ${newLastMsgId}`)
    .replace(/^exported_at: .+$/m, `exported_at: "${new Date().toISOString()}"`)

  return `---\n${updatedFrontmatter}\n---\n${body}${newMessages}`
}

/**
 * Append messages to an existing monthly archive file.
 *
 * Per CONTEXT.md: Only append to existing files, skip if file doesn't exist
 * (old months without existing files are not created during incremental sync).
 *
 * @param chatName - Display name of the chat
 * @param chatId - Numeric chat ID
 * @param yearMonth - Year-month in YYYY-MM format
 * @param messages - Array of messages to append (should be in chronological order)
 * @returns Result with count of messages appended
 */
export function appendToMonthlyFile(
  chatName: string,
  chatId: number,
  yearMonth: string,
  messages: Message[]
): AppendResult {
  // Skip if no messages
  if (messages.length === 0) {
    return { messagesAppended: 0, fileCreated: false }
  }

  // Sanitize chat name for filesystem
  const safeFilename = sanitizeFilename(chatName, chatId)

  // Build file path
  const filePath = join('data', 'archive', yearMonth, `${safeFilename}.md`)

  // Skip if file doesn't exist (per CONTEXT.md: don't create historical files)
  if (!existsSync(filePath)) {
    return { messagesAppended: 0, fileCreated: false }
  }

  // Read existing content
  const existingContent = readFileSync(filePath, 'utf-8')

  // Format new messages
  let newMessages = ''
  for (const msg of messages) {
    newMessages += formatMessage(msg)
  }

  // Get the last message ID for frontmatter update
  const newLastMsgId = messages[messages.length - 1].id

  // Update frontmatter and append messages
  const updatedContent = updateFrontmatterAndAppend(
    existingContent,
    newMessages,
    newLastMsgId
  )

  // Write updated content
  writeFileSync(filePath, updatedContent, 'utf-8')

  return { messagesAppended: messages.length, fileCreated: false }
}
