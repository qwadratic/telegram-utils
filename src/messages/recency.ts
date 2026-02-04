import type { TelegramClient, Message } from '@mtcute/node'
import { spinner } from '@clack/prompts'
import type { Config } from '../config/index.js'
import { fetchMessages } from './fetch.js'
import { formatMessage } from './format.js'
import { writeCombinedArchiveFile } from './writer.js'

export interface RecencyExportResult {
  chatsProcessed: number
  chatsWithMessages: number
  messagesExported: number
  durationMs: number
  outputPath: string
}

type RecencyMode = 'recent' | 'historical'

function sortMessagesChronological(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const timeDiff = a.date.getTime() - b.date.getTime()
    if (timeDiff !== 0) return timeDiff
    return a.id - b.id
  })
}

async function getChatName(tg: TelegramClient, chatId: number): Promise<string> {
  try {
    const peer = await tg.getPeer(chatId)
    return peer.displayName || String(chatId)
  } catch {
    return String(chatId)
  }
}

function createRecencyFrontmatter(params: {
  mode: RecencyMode
  cutoff: string
  chatsWithMessages: number
  messagesExported: number
  minDate: string | null
  maxDate: string | null
}): string {
  const now = new Date().toISOString()
  const minDateValue = params.minDate ?? 'null'
  const maxDateValue = params.maxDate ?? 'null'
  return `---
export_kind: "${params.mode}"
cutoff_date: "${params.cutoff}"
chats_with_messages: ${params.chatsWithMessages}
message_count: ${params.messagesExported}
min_date: ${minDateValue === 'null' ? 'null' : `"${minDateValue}"`}
max_date: ${maxDateValue === 'null' ? 'null' : `"${maxDateValue}"`}
exported_at: "${now}"
---

`
}

export async function exportRecencyChats(
  tg: TelegramClient,
  config: Config,
  cutoffDate: Date,
  mode: RecencyMode,
  cutoffLabel: string
): Promise<RecencyExportResult> {
  const startTime = Date.now()
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

  for (let i = 0; i < chatIdArray.length; i++) {
    const chatId = chatIdArray[i]
    const chatIndex = i + 1
    s.message(`Exporting ${mode}: chat ${chatIndex} of ${totalChats}...`)

    const chatName = await getChatName(tg, chatId)
    const messages: Message[] = []

    for await (const msg of fetchMessages(tg, chatId, {
      onProgress: (count) => {
        s.message(`Chat ${chatIndex}: fetched ${count} messages...`)
      }
    })) {
      const isMatch = isRecent
        ? msg.date >= cutoffDate
        : msg.date < cutoffDate
      if (isMatch) {
        messages.push(msg)
      }
    }

    chatsProcessed++
    if (messages.length === 0) {
      continue
    }

    chatsWithMessages++
    const orderedMessages = sortMessagesChronological(messages)
    const chatHeader = `## Chat: ${chatName} (${chatId})\n\n`
    let section = chatHeader
    for (const msg of orderedMessages) {
      section += formatMessage(msg)
    }
    sections.push(section)

    messagesExported += orderedMessages.length
    const chatMinDate = orderedMessages[0].date.toISOString()
    const chatMaxDate = orderedMessages[orderedMessages.length - 1].date.toISOString()
    if (!minDate || chatMinDate < minDate) minDate = chatMinDate
    if (!maxDate || chatMaxDate > maxDate) maxDate = chatMaxDate
  }

  const frontmatter = createRecencyFrontmatter({
    mode,
    cutoff: cutoffLabel,
    chatsWithMessages,
    messagesExported,
    minDate,
    maxDate
  })

  const body = sections.length > 0 ? sections.join('\n') : 'No messages.\n'
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
