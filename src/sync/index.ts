import type { TelegramClient, Message } from '@mtcute/node'
import { spinner, log } from '@clack/prompts'
import type { Config } from '../config/index.js'
import { updateConfig } from '../config/index.js'
import { loadState, saveState, updateChatState, updateFolderState } from './state.js'
import { detectChanges, promptNewChats, promptNewFolders, promptRemovedChats } from './detect.js'
import { appendToMonthlyFile, getCurrentYearMonth } from './append.js'
import { fetchMessages } from '../messages/fetch.js'
import { writeMonthlyFiles, groupByMonth } from '../messages/writer.js'
import { listFolders } from '../folders/index.js'

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
 * Sync chats from tracked folders incrementally.
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
 * @param config - Configuration with tracked folders
 * @returns Sync statistics
 */
export async function syncChats(
  tg: TelegramClient,
  config: Config
): Promise<SyncResult> {
  const startTime = Date.now()
  const state = loadState()
  const isFirstSync = Object.keys(state.chats).length === 0

  // Build current folder->chats map from config
  const currentFolderChats: Record<number, number[]> = config.trackedFolders
  let trackedFolderIds = Object.keys(config.trackedFolders).map(Number)

  // Detect changes
  const changes = detectChanges(state, currentFolderChats, trackedFolderIds)

  // Step 2: Handle new folders
  let newFoldersAdded = 0

  if (changes.newFolders.length > 0) {
    // Get all folders from Telegram to get names
    const allFolders = await listFolders(tg)
    const newFoldersWithNames = changes.newFolders
      .map(id => {
        const folder = allFolders.find(f => f.id === id)
        return folder ? { id, name: folder.title } : null
      })
      .filter((f): f is { id: number; name: string } => f !== null)

    if (newFoldersWithNames.length > 0) {
      log.info(`Found ${newFoldersWithNames.length} new folder(s) in Telegram`)

      const folderChoice = await promptNewFolders(newFoldersWithNames)
      if (folderChoice.action === 'track-all') {
        // Add all new folders to config
        for (const folder of newFoldersWithNames) {
          config.trackedFolders[folder.id] = currentFolderChats[folder.id] || []
        }
        newFoldersAdded = newFoldersWithNames.length
        updateConfig(config)
      } else if (folderChoice.action === 'select') {
        for (const folderId of folderChoice.selectedIds) {
          config.trackedFolders[folderId] = currentFolderChats[folderId] || []
        }
        newFoldersAdded = folderChoice.selectedIds.length
        updateConfig(config)
      }
      // Re-compute tracked folder IDs after potential config update
      trackedFolderIds = Object.keys(config.trackedFolders).map(Number)
    }
  }

  // Step 3: Handle new chats interactively
  let chatsToSync: number[] = []
  let newChatsAdded = 0

  if (isFirstSync) {
    // First sync: export all chats
    chatsToSync = Object.values(config.trackedFolders).flat()
  } else {
    // Subsequent sync: existing tracked chats
    chatsToSync = Object.keys(state.chats).map(Number)

    // Handle new chats
    if (changes.newChats.length > 0) {
      // Get names for display
      const newChatsWithNames = await Promise.all(
        changes.newChats.map(async (c) => ({
          id: c.id,
          name: await getChatName(tg, c.id)
        }))
      )
      log.info(`Found ${newChatsWithNames.length} new chat(s) in tracked folders`)

      const choice = await promptNewChats(newChatsWithNames)
      if (choice.action === 'add-all') {
        chatsToSync.push(...newChatsWithNames.map(c => c.id))
        newChatsAdded = newChatsWithNames.length
      } else if (choice.action === 'select') {
        chatsToSync.push(...choice.selectedIds)
        newChatsAdded = choice.selectedIds.length
      }
    }

    // Handle removed chats
    if (changes.removedChats.length > 0) {
      const removedWithNames = await Promise.all(
        changes.removedChats.map(async (c) => ({
          id: c.id,
          name: state.chats[c.id]?.chatName || String(c.id)
        }))
      )
      log.info(`${removedWithNames.length} chat(s) no longer in tracked folders`)

      const choice = await promptRemovedChats(removedWithNames)
      if (choice.action === 'keep-all') {
        // Keep all in sync - nothing to do
      } else if (choice.action === 'select') {
        // Remove unselected from chatsToSync
        const keepSet = new Set(choice.keepIds)
        chatsToSync = chatsToSync.filter(id => keepSet.has(id) || !removedWithNames.some(r => r.id === id))
      } else if (choice.action === 'remove-all') {
        // Remove all from chatsToSync
        const removedSet = new Set(removedWithNames.map(r => r.id))
        chatsToSync = chatsToSync.filter(id => !removedSet.has(id))
      }
    }
  }

  // Step 4: Sync each chat
  const s = spinner()
  s.start('Starting sync...')

  const currentMonth = getCurrentYearMonth()
  let messagesAppended = 0
  let filesUpdated = 0
  let chatsProcessed = 0
  let chatsSkipped = 0

  // Deduplicate chat IDs
  const uniqueChatIds = [...new Set(chatsToSync)]

  for (const chatId of uniqueChatIds) {
    const chatName = await getChatName(tg, chatId)
    const lastMsgId = state.chats[chatId]?.lastMessageId

    s.message(`Syncing ${chatName}...`)

    // Fetch messages (with minId if we have prior state)
    const messages: Message[] = []
    for await (const msg of fetchMessages(tg, chatId, {
      minId: lastMsgId,
      onProgress: (count) => s.message(`${chatName}: fetched ${count} messages...`)
    })) {
      messages.push(msg)
    }

    if (messages.length === 0) {
      chatsSkipped++
      continue
    }

    chatsProcessed++

    if (isFirstSync || !lastMsgId) {
      // Full export for new chats
      const { messagesWritten, filesWritten } = await writeMonthlyFiles(chatName, chatId, messages)
      messagesAppended += messagesWritten
      filesUpdated += filesWritten
    } else {
      // Incremental: append to current month only
      const grouped = groupByMonth(messages)
      const currentMonthMsgs = grouped.get(currentMonth)

      if (currentMonthMsgs && currentMonthMsgs.length > 0) {
        const result = appendToMonthlyFile(chatName, chatId, currentMonth, currentMonthMsgs)
        messagesAppended += result.messagesAppended
        if (result.messagesAppended > 0) filesUpdated++
      }

      // Log skipped old months
      for (const [month, msgs] of grouped) {
        if (month !== currentMonth && msgs.length > 0) {
          log.warn(`Skipped ${msgs.length} messages from ${month} (old month)`)
        }
      }
    }

    // Update state for this chat
    // messages are newest-first from API
    const newestMsgId = messages[0].id
    updateChatState(state, chatId, newestMsgId, chatName)
  }

  // Update folder state snapshots
  for (const folderId of trackedFolderIds) {
    updateFolderState(state, folderId, config.trackedFolders[folderId] || [])
  }

  saveState(state)

  s.stop('Sync complete')

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
