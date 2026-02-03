import { TelegramClient, tl } from '@mtcute/node'
import { getMarkedPeerId } from '@mtcute/core'
import { multiselect, isCancel } from '@clack/prompts'
import { loadConfig, saveConfig, Config } from '../config/index.js'

/**
 * Basic folder information for display
 */
export interface FolderInfo {
  id: number
  title: string
  chatCount: number
}

/**
 * Folder type that contains enumerable peers (excludes dialogFilterDefault)
 */
export type EnumerableFolder = tl.RawDialogFilter | tl.RawDialogFilterChatlist

/**
 * List all user folders with their basic info.
 * Excludes the "All Chats" pseudo-folder (dialogFilterDefault).
 */
export async function listFolders(tg: TelegramClient): Promise<FolderInfo[]> {
  const result = await tg.getFolders()

  const folders: FolderInfo[] = []

  for (const filter of result.filters) {
    // Skip "All Chats" pseudo-folder - it has no enumerable content
    if (filter._ === 'dialogFilterDefault') {
      continue
    }

    // Both dialogFilter and dialogFilterChatlist have id, title, pinnedPeers, includePeers
    folders.push({
      id: filter.id,
      title: filter.title.text,
      chatCount: filter.pinnedPeers.length + filter.includePeers.length,
    })
  }

  // Sort by folder ID for consistent ordering
  return folders.sort((a, b) => a.id - b.id)
}

/**
 * Extract marked chat IDs from a folder's peer lists.
 * Marked IDs are bot API compatible (positive for users, negative for chats/channels).
 */
export function getChatIdsFromFolder(folder: EnumerableFolder): number[] {
  const peers = [...folder.pinnedPeers, ...folder.includePeers]

  const chatIds: number[] = []

  for (const peer of peers) {
    // Skip empty and self peers - they don't represent actual chats
    if (peer._ === 'inputPeerEmpty' || peer._ === 'inputPeerSelf') {
      continue
    }

    // getMarkedPeerId converts InputPeer to marked ID:
    // - Users: positive ID
    // - Chats: negative ID
    // - Channels: negative ID with -1e12 offset
    chatIds.push(getMarkedPeerId(peer))
  }

  return chatIds
}

/**
 * Interactive folder selection using multiselect prompt.
 * Returns array of selected folder IDs.
 */
export async function selectFolders(folders: FolderInfo[]): Promise<number[]> {
  const selected = await multiselect({
    message: 'Select folders to track:',
    options: folders.map(f => ({
      value: f.id,
      label: `${f.title} (${f.chatCount} chats)`
    })),
    required: true
  })

  if (isCancel(selected)) {
    process.exit(0)
  }

  return selected as number[]
}

/**
 * Compare stored and current chat lists to detect changes.
 * Returns arrays of added and removed chat IDs.
 */
export function diffChatLists(
  stored: number[],
  current: number[]
): { added: number[]; removed: number[] } {
  const storedSet = new Set(stored)
  const currentSet = new Set(current)

  const added = current.filter(id => !storedSet.has(id))
  const removed = stored.filter(id => !currentSet.has(id))

  return { added, removed }
}

/**
 * Main orchestration function for the folders command.
 * Handles first-run selection and subsequent diff tracking.
 */
export async function syncFolderConfig(tg: TelegramClient): Promise<void> {
  // Get folder info for display
  const folders = await listFolders(tg)

  if (folders.length === 0) {
    console.log('No folders found in your Telegram account.')
    return
  }

  // Get raw filters for chat ID extraction
  const rawResult = await tg.getFolders()
  const rawFilters = rawResult.filters.filter(
    (f): f is EnumerableFolder => f._ !== 'dialogFilterDefault'
  )

  // Load existing config
  const config = loadConfig()
  const isFirstRun = Object.keys(config.trackedFolders).length === 0

  // Determine which folders to track
  let trackedFolderIds: number[]

  if (isFirstRun) {
    // First run: show selection prompt
    console.log(`Found ${folders.length} folder(s):`)
    trackedFolderIds = await selectFolders(folders)
  } else {
    // Subsequent run: use existing tracked folders
    trackedFolderIds = Object.keys(config.trackedFolders).map(Number)
    console.log(`Syncing ${trackedFolderIds.length} tracked folder(s)...`)
  }

  // Process each tracked folder
  let totalChats = 0

  for (const folderId of trackedFolderIds) {
    const rawFilter = rawFilters.find(f => f.id === folderId)

    if (!rawFilter) {
      console.log(`Folder ${folderId} no longer exists, removing from config`)
      delete config.trackedFolders[folderId]
      continue
    }

    const currentChatIds = getChatIdsFromFolder(rawFilter)
    totalChats += currentChatIds.length

    // Check for changes if folder existed in config
    if (config.trackedFolders[folderId]) {
      const { added, removed } = diffChatLists(
        config.trackedFolders[folderId],
        currentChatIds
      )

      for (const id of added) {
        console.log(`New chat: ${id}`)
      }
      for (const id of removed) {
        console.log(`Removed chat: ${id}`)
      }
    }

    // Update config with current chat IDs
    config.trackedFolders[folderId] = currentChatIds
  }

  // Save updated config
  saveConfig(config)

  console.log(`Tracking ${trackedFolderIds.length} folders with ${totalChats} total chats`)
}
