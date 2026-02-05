import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TelegramClient, Message } from '@mtcute/node'
import { spinner } from '@clack/prompts'
import type { Config } from '../config/index.js'
import { getChatName } from '../utils/chat-name.js'
import { loadState, saveState } from '../sync/state.js'
import { fetchMessages } from './fetch.js'
import { formatMessage } from './format.js'
import { buildRecencyFrontmatter } from './frontmatter.js'
import { sortMessagesChronological } from './sort.js'
import { writeCombinedArchiveFile } from './writer.js'

export interface RecencyExportResult {
  chatsProcessed: number
  chatsWithMessages: number
  messagesExported: number
  durationMs: number
  outputPath: string
}

type RecencyMode = 'recent' | 'historical'

type MessageBlock = {
  text: string
  timestamp: Date | null
}

type ParsedSection = {
  header: string
  blocks: MessageBlock[]
}

function parseTimestamp(value: string): Date | null {
  const iso = value.replace(' UTC', 'Z').replace(' ', 'T')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const match = content.match(/^---\n[\s\S]*?\n---\n\n/)
  if (!match) return { frontmatter: null, body: content }
  return { frontmatter: match[0], body: content.slice(match[0].length) }
}

function parseCombinedSections(body: string): Map<number, ParsedSection> {
  const sections = new Map<number, ParsedSection>()
  if (body.trim() === 'No messages.') {
    return sections
  }

  const lines = body.split('\n')
  let currentChatId: number | null = null
  let currentHeader = ''
  let currentBlocks: MessageBlock[] = []
  let currentBlockLines: string[] | null = null
  let currentBlockDate: Date | null = null

  const flushBlock = () => {
    if (!currentBlockLines || !currentChatId) return
    const text = `${currentBlockLines.join('\n')}\n`
    currentBlocks.push({ text, timestamp: currentBlockDate })
    currentBlockLines = null
    currentBlockDate = null
  }

  const flushSection = () => {
    if (currentChatId == null) return
    sections.set(currentChatId, { header: currentHeader, blocks: currentBlocks })
    currentChatId = null
    currentHeader = ''
    currentBlocks = []
  }

  for (const line of lines) {
    if (line.startsWith('## Chat: ')) {
      flushBlock()
      flushSection()
      const idMatch = line.match(/\((\-?\d+)\)\s*$/)
      if (!idMatch) continue
      currentChatId = Number(idMatch[1])
      currentHeader = line
      continue
    }

    const headerMatch = line.match(/^\*\*\[(.+?)\]\*\*/)
    if (headerMatch) {
      flushBlock()
      currentBlockLines = [line]
      currentBlockDate = parseTimestamp(headerMatch[1])
      continue
    }

    if (currentBlockLines) {
      currentBlockLines.push(line)
    }
  }

  flushBlock()
  flushSection()
  return sections
}

function filterBlocksByCutoff(
  blocks: MessageBlock[],
  cutoffDate: Date | null,
  mode: RecencyMode
): MessageBlock[] {
  return blocks.filter((block) => {
    if (!cutoffDate) return true
    if (!block.timestamp) return true
    return mode === 'recent'
      ? block.timestamp >= cutoffDate
      : block.timestamp < cutoffDate
  })
}

function buildSectionBody(blocks: MessageBlock[]): string {
  return blocks.map(block => block.text).join('')
}

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

function parseRecencyFrontmatter(frontmatter: string | null): {
  messageCount: number
  chatsWithMessages: number
  minDate: string | null
  maxDate: string | null
} {
  if (!frontmatter) {
    return { messageCount: 0, chatsWithMessages: 0, minDate: null, maxDate: null }
  }
  const messageCount = Number(getFrontmatterValue(frontmatter, 'message_count') ?? 0)
  const chatsWithMessages = Number(getFrontmatterValue(frontmatter, 'chats_with_messages') ?? 0)
  const minDate = getFrontmatterValue(frontmatter, 'min_date')
  const maxDate = getFrontmatterValue(frontmatter, 'max_date')
  return { messageCount, chatsWithMessages, minDate, maxDate }
}

function extractChatIds(body: string): Set<number> {
  const ids = new Set<number>()
  const regex = /^## Chat: .*?\((\-?\d+)\)\s*$/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(body)) !== null) {
    ids.add(Number(match[1]))
  }
  return ids
}

function appendMessagesToBody(
  body: string,
  chatId: number,
  header: string,
  newBody: string
): { body: string; isNewSection: boolean } {
  const headerRegex = new RegExp(`^## Chat: .*?\\(${chatId}\\)\\s*$`, 'm')
  const match = headerRegex.exec(body)
  if (!match) {
    const trimmed = body.trim()
    const prefix = trimmed ? `${trimmed}\n\n` : ''
    return { body: `${prefix}${header}\n\n${newBody}`.trimEnd() + '\n', isNewSection: true }
  }

  const startIndex = match.index
  const afterHeader = startIndex + match[0].length
  const nextHeaderRegex = /^## Chat: /gm
  nextHeaderRegex.lastIndex = afterHeader
  const nextMatch = nextHeaderRegex.exec(body)
  const insertIndex = nextMatch ? nextMatch.index : body.length
  const insertion = `${body[insertIndex - 1] === '\n' ? '' : '\n'}${newBody}`
  const updatedBody = body.slice(0, insertIndex) + insertion + body.slice(insertIndex)
  return { body: updatedBody, isNewSection: false }
}

function compareCutoffForward(previous: string, next: string): boolean {
  const prevDate = new Date(`${previous}T00:00:00Z`)
  const nextDate = new Date(`${next}T00:00:00Z`)
  return nextDate.getTime() >= prevDate.getTime()
}

export async function exportRecencyChats(
  tg: TelegramClient,
  config: Config,
  cutoffDate: Date | null,
  mode: RecencyMode,
  cutoffLabel: string | null
): Promise<RecencyExportResult> {
  const startTime = Date.now()
  const state = loadState()
  const recencyState = state.recency[mode]
  const previousCutoff = recencyState.cutoff
  if (mode === 'recent') {
    if (!cutoffDate || !cutoffLabel) {
      throw new Error('Cutoff is required for recent exports.')
    }
  }

  let shouldUseIncremental =
    previousCutoff != null &&
    cutoffLabel != null &&
    compareCutoffForward(previousCutoff, cutoffLabel)
  if (cutoffLabel && previousCutoff && !shouldUseIncremental) {
    throw new Error(`Cutoff must not move earlier than ${previousCutoff}.`)
  }

  const chatIdArray = [...new Set(config.trackedChatIds)]
  const totalChats = chatIdArray.length

  let chatsProcessed = 0
  let chatsWithMessages = 0
  let messagesExported = 0
  let minDate: string | null = null
  let maxDate: string | null = null

  const s = spinner()
  s.start(`Exporting ${mode} messages...`)

  const sections: string[] = []
  const isRecent = mode === 'recent'
  const outputFilePath = join('data', 'archive', `${mode}.md`)
  const parsedSections = new Map<number, ParsedSection>()
  const hasExistingFile = existsSync(outputFilePath)
  const appendMode =
    isRecent &&
    shouldUseIncremental &&
    hasExistingFile &&
    cutoffLabel != null &&
    previousCutoff === cutoffLabel
  let existingFrontmatter: string | null = null
  let existingBody = ''
  let existingChatIds = new Set<number>()
  let existingCounts = { messageCount: 0, chatsWithMessages: 0, minDate: null as string | null, maxDate: null as string | null }
  if (appendMode) {
    const existing = readFileSync(outputFilePath, 'utf-8')
    const { frontmatter, body } = splitFrontmatter(existing)
    existingFrontmatter = frontmatter
    existingBody = body.trim() === 'No messages.' ? '' : body
    existingChatIds = extractChatIds(existingBody)
    existingCounts = parseRecencyFrontmatter(frontmatter)
  } else if (shouldUseIncremental && hasExistingFile) {
    const existing = readFileSync(outputFilePath, 'utf-8')
    const { body } = splitFrontmatter(existing)
    const existingSections = parseCombinedSections(body)
    for (const [chatId, section] of existingSections) {
      const filteredBlocks = isRecent
        ? filterBlocksByCutoff(section.blocks, cutoffDate, mode)
        : section.blocks
      parsedSections.set(chatId, { header: section.header, blocks: filteredBlocks })
    }
  } else if (shouldUseIncremental && !hasExistingFile) {
    shouldUseIncremental = false
  }

  const nextRecencyChats: typeof recencyState.chats = {}

  for (let i = 0; i < chatIdArray.length; i++) {
    const chatId = chatIdArray[i]
    const chatIndex = i + 1
    s.message(`Exporting ${mode}: chat ${chatIndex} of ${totalChats}...`)

    const chatName = await getChatName(tg, chatId)
    const messages: Message[] = []
    let latestFetchedId: number | null = null

    const minId = shouldUseIncremental
      ? recencyState.chats[chatId]?.lastMessageId
      : undefined

    for await (const msg of fetchMessages(tg, chatId, {
      minId,
      onProgress: (count) => {
        s.message(`Chat ${chatIndex}: fetched ${count} messages...`)
      }
    })) {
      if (latestFetchedId == null) {
        latestFetchedId = msg.id
      }
      const isMatch = !cutoffDate
        ? true
        : isRecent
          ? msg.date >= cutoffDate
          : msg.date < cutoffDate
      if (isMatch) {
        messages.push(msg)
      }
    }

    chatsProcessed++
    const orderedMessages = messages.length > 0
      ? sortMessagesChronological(messages)
      : []
    const newBlocks = orderedMessages.map((msg) => ({
      text: formatMessage(msg),
      timestamp: msg.date
    }))

    if (appendMode && newBlocks.length > 0) {
      const header = `## Chat: ${chatName} (${chatId})`
      const sectionBody = buildSectionBody(newBlocks)
      const result = appendMessagesToBody(existingBody, chatId, header, sectionBody)
      existingBody = result.body
      if (result.isNewSection) {
        existingChatIds.add(chatId)
        existingCounts.chatsWithMessages += 1
      }

      existingCounts.messageCount += newBlocks.length
      const blockDates = newBlocks
        .map(block => block.timestamp)
        .filter((date): date is Date => date != null)
        .map(date => date.toISOString())
      if (blockDates.length > 0) {
        const chatMinDate = blockDates[0]
        const chatMaxDate = blockDates[blockDates.length - 1]
        if (!existingCounts.minDate || chatMinDate < existingCounts.minDate) {
          existingCounts.minDate = chatMinDate
        }
        if (!existingCounts.maxDate || chatMaxDate > existingCounts.maxDate) {
          existingCounts.maxDate = chatMaxDate
        }
      }
    } else if (!appendMode) {
      const existingSection = parsedSections.get(chatId)
      const mergedBlocks = [
        ...(existingSection?.blocks ?? []),
        ...newBlocks
      ]

      if (mergedBlocks.length > 0) {
        chatsWithMessages++
        const header = existingSection?.header ?? `## Chat: ${chatName} (${chatId})`
        const sectionBody = buildSectionBody(mergedBlocks)
        sections.push(`${header}\n\n${sectionBody}`)

        messagesExported += mergedBlocks.length
        const blockDates = mergedBlocks
          .map(block => block.timestamp)
          .filter((date): date is Date => date != null)
          .map(date => date.toISOString())
        if (blockDates.length > 0) {
          const chatMinDate = blockDates[0]
          const chatMaxDate = blockDates[blockDates.length - 1]
          if (!minDate || chatMinDate < minDate) minDate = chatMinDate
          if (!maxDate || chatMaxDate > maxDate) maxDate = chatMaxDate
        }
      }
    }

    const now = new Date().toISOString()
    if (mode === 'recent') {
      const lastMessageId = latestFetchedId ?? recencyState.chats[chatId]?.lastMessageId
      if (lastMessageId != null && lastMessageId > 0) {
        nextRecencyChats[chatId] = { lastMessageId, lastExportedAt: now }
        recencyState.chats[chatId] = { lastMessageId, lastExportedAt: now }
      }
    } else {
      const newestIncludedId = orderedMessages.length > 0
        ? orderedMessages[orderedMessages.length - 1].id
        : recencyState.chats[chatId]?.lastMessageId
      if (newestIncludedId != null && newestIncludedId > 0) {
        nextRecencyChats[chatId] = { lastMessageId: newestIncludedId, lastExportedAt: now }
        recencyState.chats[chatId] = { lastMessageId: newestIncludedId, lastExportedAt: now }
      }
    }

    saveState(state)
  }

  recencyState.chats = nextRecencyChats
  recencyState.cutoff = cutoffLabel
  saveState(state)

  if (appendMode) {
    messagesExported = existingCounts.messageCount
    chatsWithMessages = existingCounts.chatsWithMessages
    minDate = existingCounts.minDate
    maxDate = existingCounts.maxDate
  }

  const frontmatter = buildRecencyFrontmatter({
    mode,
    cutoff: cutoffLabel,
    chatsWithMessages,
    messagesExported,
    minDate,
    maxDate
  })

  const body = appendMode
    ? (existingBody.trim() ? existingBody : 'No messages.\n')
    : sections.length > 0
      ? sections.join('\n')
      : 'No messages.\n'
  const outputPath = writeCombinedArchiveFile(`${mode}.md`, `${frontmatter}${body}`)

  const durationMs = Date.now() - startTime
  s.stop(`Exported ${messagesExported} ${mode} messages`)

  return {
    chatsProcessed,
    chatsWithMessages,
    messagesExported,
    durationMs,
    outputPath
  }
}
