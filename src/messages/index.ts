import type { TelegramClient, Message } from '@mtcute/node'
import { spinner } from '@clack/prompts'
import type { Config } from '../config/index.js'
import { fetchMessages, sleep } from './fetch.js'
import { writeChatFile } from './writer.js'

/**
 * Result from a complete export operation.
 */
export interface ExportResult {
  chatsExported: number
  chatsSkipped: number
  messagesExported: number
  durationMs: number
}

/**
 * Get display name for a chat.
 *
 * @param tg - Telegram client
 * @param chatId - Chat ID to look up
 * @returns Chat name or fallback to string ID
 */
async function getChatName(tg: TelegramClient, chatId: number): Promise<string> {
  try {
    // getPeer returns User | Chat, both have displayName
    const peer = await tg.getPeer(chatId)
    return peer.displayName || String(chatId)
  } catch {
    // Fallback to chat ID if lookup fails
    return String(chatId)
  }
}

/**
 * Export all tracked chats.
 *
 * Orchestrates the complete export flow:
 * - Shows spinner with progress updates
 * - Fetches messages with rate limiting (1.5s + jitter between chunks)
 * - Displays rate limit waits explicitly
 * - Skips empty chats with log message
 * - Writes messages to monthly Markdown files
 *
 * @param tg - Connected Telegram client
 * @param config - Configuration with tracked chats
 * @returns Export statistics
 */
export async function exportChats(
  tg: TelegramClient,
  config: Config
): Promise<ExportResult> {
  const startTime = Date.now()

  const chatIdArray = [...new Set(config.trackedChatIds)]
  const totalChats = chatIdArray.length

  let chatsExported = 0
  let chatsSkipped = 0
  let messagesExported = 0

  const s = spinner()
  s.start(`Exporting 0 of ${totalChats} chats...`)

  for (let i = 0; i < chatIdArray.length; i++) {
    const chatId = chatIdArray[i]
    const chatIndex = i + 1

    s.message(`Exporting chat ${chatIndex} of ${totalChats}...`)

    // Get chat name for display and filename
    const chatName = await getChatName(tg, chatId)

    // Collect all messages from the generator
    const messages: Message[] = []
    let lastProgressCount = 0

    for await (const msg of fetchMessages(tg, chatId, {
      onProgress: (count) => {
        // Progress callback - called after each chunk
        lastProgressCount = count
        s.message(`Chat ${chatIndex}: fetched ${count} messages...`)
      }
    })) {
      messages.push(msg)

      // Show rate limit wait after each chunk (when count is multiple of 100)
      if (messages.length > 0 && messages.length % 100 === 0) {
        s.message(`Rate limiting: waiting 1.5s...`)
      }
    }

    // Skip empty chats
    if (messages.length === 0) {
      console.log(`Skipping empty chat: ${chatName}`)
      chatsSkipped++
      continue
    }

    // Write to monthly files
    const { messagesWritten } = await writeChatFile(chatName, chatId, messages)

    chatsExported++
    messagesExported += messagesWritten
  }

  const durationMs = Date.now() - startTime
  s.stop(`Exported ${chatsExported} chats, ${messagesExported} messages`)

  return {
    chatsExported,
    chatsSkipped,
    messagesExported,
    durationMs,
  }
}
