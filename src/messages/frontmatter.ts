function buildFrontmatterBlock(lines: string[]): string {
  return `---\n${lines.join('\n')}\n---\n\n`
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
export function buildFrontmatter(
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

  return buildFrontmatterBlock([
    `chat_name: "${escapedName}"`,
    `chat_id: ${chatId}`,
    `first_message_id: ${firstMsgId}`,
    `last_message_id: ${lastMsgId}`,
    `message_count: ${messageCount}`,
    `min_date: "${minDate}"`,
    `max_date: "${maxDate}"`,
    `exported_at: "${now}"`
  ])
}

/**
 * Create YAML frontmatter for an empty chat archive file.
 */
export function buildEmptyFrontmatter(chatName: string, chatId: number): string {
  const now = new Date().toISOString()
  const escapedName = chatName.replace(/"/g, '\\"')

  return buildFrontmatterBlock([
    `chat_name: "${escapedName}"`,
    `chat_id: ${chatId}`,
    'first_message_id: null',
    'last_message_id: null',
    'message_count: 0',
    'min_date: null',
    'max_date: null',
    `exported_at: "${now}"`
  ])
}

export function buildRecencyFrontmatter(params: {
  mode: 'recent' | 'historical'
  cutoff: string | null
  chatsWithMessages: number
  messagesExported: number
  minDate: string | null
  maxDate: string | null
}): string {
  const now = new Date().toISOString()
  const minDateValue = params.minDate ?? 'null'
  const maxDateValue = params.maxDate ?? 'null'
  const cutoffValue = params.cutoff ?? 'null'
  return buildFrontmatterBlock([
    `export_kind: "${params.mode}"`,
    `cutoff_date: ${cutoffValue === 'null' ? 'null' : `"${cutoffValue}"`}`,
    `chats_with_messages: ${params.chatsWithMessages}`,
    `message_count: ${params.messagesExported}`,
    `min_date: ${minDateValue === 'null' ? 'null' : `"${minDateValue}"`}`,
    `max_date: ${maxDateValue === 'null' ? 'null' : `"${maxDateValue}"`}`,
    `exported_at: "${now}"`
  ])
}

export function getFrontmatterValue(frontmatter: string, key: string): string | null {
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

function upsertField(source: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}:\\s*.+$`, 'm')
  if (regex.test(source)) {
    return source.replace(regex, `${key}: ${value}`)
  }
  return `${source}\n${key}: ${value}`
}

export function updateFrontmatter(options: {
  frontmatter: string
  newLastMsgId: number
  newMessageCount: number
  newMinDate: string
  newMaxDate: string
}): string {
  const existingCount = Number(getFrontmatterValue(options.frontmatter, 'message_count') ?? 0)
  const existingMinDate = getFrontmatterValue(options.frontmatter, 'min_date')
  const existingMaxDate = getFrontmatterValue(options.frontmatter, 'max_date')

  const minDate = existingMinDate
    ? new Date(existingMinDate) < new Date(options.newMinDate) ? existingMinDate : options.newMinDate
    : options.newMinDate
  const maxDate = existingMaxDate
    ? new Date(existingMaxDate) > new Date(options.newMaxDate) ? existingMaxDate : options.newMaxDate
    : options.newMaxDate

  let updatedFrontmatter = options.frontmatter
  updatedFrontmatter = upsertField(updatedFrontmatter, 'last_message_id', String(options.newLastMsgId))
  updatedFrontmatter = upsertField(
    updatedFrontmatter,
    'message_count',
    String(existingCount + options.newMessageCount)
  )
  updatedFrontmatter = upsertField(updatedFrontmatter, 'min_date', `"${minDate}"`)
  updatedFrontmatter = upsertField(updatedFrontmatter, 'max_date', `"${maxDate}"`)
  updatedFrontmatter = upsertField(updatedFrontmatter, 'exported_at', `"${new Date().toISOString()}"`)

  return updatedFrontmatter
}
