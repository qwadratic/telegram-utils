import type { TelegramClient, Message } from '@mtcute/node'
import { spinner, log } from '@clack/prompts'
import type { Config } from '../config/index.js'
import { loadState, saveState, updateChatState } from './state.js'
import { appendToChatFile } from './append.js'
import { fetchMessages } from '../messages/fetch.js'
import { writeChatFile } from '../messages/writer.js'

/**
 * Result from a sync operation.
 */
export interface SyncResult {
  chatsProcessed: number
  messagesAppended: number
  filesUpdated: number
  newChatsAdded: number
  newFoldersAdded: number
  chatsSkipped: number
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
    const peer = await tg.getPeer(chatId)
    return peer.displayName || String(chatId)
  } catch {
    return String(chatId)
  }
}

/**
 * Sync tracked chats incrementally.
 *
 * Orchestrates the complete sync flow:
 * 1. Load state and detect changes (new/removed chats, new folders)
 * 2. Prompt user for new folders detected in Telegram
 * 3. Prompt user for new/removed chats
 * 4. Fetch messages incrementally (only newer than last sync)
 * 5. Append to existing files or write new files
 * 6. Save updated state
 *
 * @param tg - Connected Telegram client
 * @param config - Configuration with tracked chats
 * @returns Sync statistics
 */
export async function syncChats(
  tg: TelegramClient,
  config: Config
): Promise<SyncResult> {
  const startTime = Date.now()
  const state = loadState()
  const isFirstSync = Object.keys(state.chats).length === 0

  // Use tracked chat IDs from config for every run
  const chatsToSync = config.trackedChatIds
  const newChatsAdded = chatsToSync.filter(id => !state.chats[id]).length
  const newFoldersAdded = 0

  // Step 4: Sync each chat
  const s = spinner()
  s.start('Starting sync...')

  let messagesAppended = 0
  let filesUpdated = 0
  let chatsProcessed = 0
  let chatsSkipped = 0
  let currentSpinnerMessage = 'Starting sync...'
  const skippedChats: string[] = []
  const newChatLabels: string[] = []

  const logWithSpinner = (message: string) => {
    s.stop()
    log.info(message)
    s.start(currentSpinnerMessage)
  }

  // Deduplicate chat IDs
  const uniqueChatIds = [...new Set(chatsToSync)]

  for (const chatId of uniqueChatIds) {
    const chatName = await getChatName(tg, chatId)
    const existingChat = state.chats[chatId]
    const lastMsgId = existingChat?.lastMessageId
    if (!existingChat) {
      newChatLabels.push(`${chatName} (${chatId})`)
    }

    currentSpinnerMessage = `Syncing ${chatName}...`
    s.message(currentSpinnerMessage)

    // Fetch messages (with minId if we have prior state)
    const messages: Message[] = []
    for await (const msg of fetchMessages(tg, chatId, {
      minId: lastMsgId,
      onProgress: (count) => s.message(`${chatName}: fetched ${count} messages...`)
    })) {
      messages.push(msg)
    }

    if (messages.length === 0) {
      skippedChats.push(`${chatName} (${chatId})`)
      chatsSkipped++
      continue
    }

    chatsProcessed++

    if (isFirstSync || !lastMsgId) {
      // Full export for new chats
      const { messagesWritten, filesWritten } = await writeChatFile(chatName, chatId, messages)
      messagesAppended += messagesWritten
      filesUpdated += filesWritten
    } else {
      // Incremental: append all new messages to existing chat file
      const result = appendToChatFile(chatName, chatId, messages)
      messagesAppended += result.messagesAppended
      if (result.messagesAppended > 0) filesUpdated++
    }

    // Update state for this chat
    // messages are newest-first from API
    const newestMsgId = messages[0].id
    updateChatState(state, chatId, newestMsgId, chatName)
  }

  saveState(state)

  s.stop('Sync complete')

  if (skippedChats.length > 0) {
    const preview = skippedChats.slice(0, 3)
    const remaining = skippedChats.length - preview.length
    console.log('Skipped chats:')
    for (const chatLabel of preview) {
      console.log(chatLabel)
    }
    if (remaining > 0) {
      console.log(`... and ${remaining} more\n`)
    }
  }

  if (newChatLabels.length > 0) {
    const preview = newChatLabels.slice(0, 3)
    const remaining = newChatLabels.length - preview.length
    console.log('New chats added:')
    for (const chatLabel of preview) {
      console.log(chatLabel)
    }
    if (remaining > 0) {
      console.log(`... and ${remaining} more`)
    }
  }

  return {
    chatsProcessed,
    messagesAppended,
    filesUpdated,
    newChatsAdded,
    newFoldersAdded,
    chatsSkipped,
    durationMs: Date.now() - startTime
  }
}
