import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Message } from '@mtcute/node'
import { formatMessage } from '../messages/format.js'
import { createFrontmatter } from '../messages/writer.js'
import { sanitizeFilename } from '../utils/filename.js'

/**
 * Result of appending messages to a monthly file.
 */
export interface AppendResult {
  messagesAppended: number
  fileCreated: boolean
}

/**
 * Extract a scalar frontmatter value by key.
 */
function getFrontmatterValue(frontmatter: string, key: string): string | null {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm')
  const match = frontmatter.match(regex)
  if (!match) return null
  const rawValue = match[1].trim()
  if (rawValue === 'null') return null
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1).replace(/\\"/g, '"')
  }
  return rawValue
}

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
 * Update frontmatter with new counts and dates, then append messages.
 *
 * @param existingContent - Current file content
 * @param newMessages - Formatted messages to append
 * @param newLastMsgId - ID of the last message being appended
 * @param newMessageCount - Number of messages being appended
 * @param newMinDate - Earliest date of appended messages (ISO 8601)
 * @param newMaxDate - Latest date of appended messages (ISO 8601)
 * @returns Updated file content
 */
function updateFrontmatterAndAppend(
  existingContent: string,
  newMessages: string,
  newLastMsgId: number,
  newMessageCount: number,
  newMinDate: string,
  newMaxDate: string
): string {
  // Match frontmatter block
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/
  const match = existingContent.match(frontmatterRegex)

  if (!match) {
    throw new Error('Invalid file format: no frontmatter found')
  }

  const frontmatter = match[1]
  const body = existingContent.slice(match[0].length)

  const existingCount = Number(getFrontmatterValue(frontmatter, 'message_count') ?? 0)
  const existingMinDate = getFrontmatterValue(frontmatter, 'min_date')
  const existingMaxDate = getFrontmatterValue(frontmatter, 'max_date')

  const minDate = existingMinDate
    ? new Date(existingMinDate) < new Date(newMinDate) ? existingMinDate : newMinDate
    : newMinDate
  const maxDate = existingMaxDate
    ? new Date(existingMaxDate) > new Date(newMaxDate) ? existingMaxDate : newMaxDate
    : newMaxDate

  const upsertField = (source: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}:\\s*.+$`, 'm')
    if (regex.test(source)) {
      return source.replace(regex, `${key}: ${value}`)
    }
    return `${source}\n${key}: ${value}`
  }

  // Update last_message_id, message_count, dates, and exported_at
  let updatedFrontmatter = frontmatter
  updatedFrontmatter = upsertField(updatedFrontmatter, 'last_message_id', String(newLastMsgId))
  updatedFrontmatter = upsertField(
    updatedFrontmatter,
    'message_count',
    String(existingCount + newMessageCount)
  )
  updatedFrontmatter = upsertField(updatedFrontmatter, 'min_date', `"${minDate}"`)
  updatedFrontmatter = upsertField(updatedFrontmatter, 'max_date', `"${maxDate}"`)
  updatedFrontmatter = upsertField(updatedFrontmatter, 'exported_at', `"${new Date().toISOString()}"`)

  return `---\n${updatedFrontmatter}\n---\n${body}${newMessages}`
}

/**
 * Append messages to an existing chat archive file.
 *
 * Per CONTEXT.md: Only append to existing files, skip if file doesn't exist.
 *
 * @param chatName - Display name of the chat
 * @param chatId - Numeric chat ID
 * @param messages - Array of messages to append (can be in any order)
 * @returns Result with count of messages appended
 */
export function appendToChatFile(
  chatName: string,
  chatId: number,
  messages: Message[]
): AppendResult {
  // Skip if no messages
  if (messages.length === 0) {
    return { messagesAppended: 0, fileCreated: false }
  }

  // Sanitize chat name for filesystem
  const safeFilename = sanitizeFilename(chatName, chatId)

  // Build file path
  const filePath = join('data', 'archive', `${safeFilename}.md`)

  // Create file if it doesn't exist to avoid data loss
  if (!existsSync(filePath)) {
    const orderedMessages = sortMessagesChronological(messages)
    const dirPath = join('data', 'archive')
    mkdirSync(dirPath, { recursive: true })

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

    return { messagesAppended: orderedMessages.length, fileCreated: true }
  }

  // Read existing content
  const existingContent = readFileSync(filePath, 'utf-8')

  const orderedMessages = sortMessagesChronological(messages)

  // Format new messages
  let newMessages = ''
  for (const msg of orderedMessages) {
    newMessages += formatMessage(msg)
  }

  // Get the last message ID for frontmatter update
  const newLastMsgId = orderedMessages[orderedMessages.length - 1].id
  const newMinDate = orderedMessages[0].date.toISOString()
  const newMaxDate = orderedMessages[orderedMessages.length - 1].date.toISOString()

  // Update frontmatter and append messages
  const updatedContent = updateFrontmatterAndAppend(
    existingContent,
    newMessages,
    newLastMsgId,
    orderedMessages.length,
    newMinDate,
    newMaxDate
  )

  // Write updated content
  writeFileSync(filePath, updatedContent, 'utf-8')

  return { messagesAppended: messages.length, fileCreated: false }
}
