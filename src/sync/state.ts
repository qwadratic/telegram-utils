import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Sync state structure for tracking incremental exports.
 * Stores last message ID per chat and folder membership snapshots.
 */
export interface SyncState {
  version: 1
  chats: Record<number, {
    lastMessageId: number
    lastSyncedAt: string  // ISO timestamp
    chatName: string      // Cached for display
  }>
  folders: Record<number, {
    chatIds: number[]     // Snapshot at last sync
    lastSyncedAt: string
  }>
}

/**
 * Path to the sync state file
 */
export const STATE_PATH = 'data/sync-state.json'

/**
 * Load sync state from disk. Returns empty state if file doesn't exist.
 * Uses sync operations for CLI simplicity and to avoid race conditions.
 */
export function loadState(): SyncState {
  if (!existsSync(STATE_PATH)) {
    return { version: 1, chats: {}, folders: {} }
  }

  const content = readFileSync(STATE_PATH, 'utf-8')
  return JSON.parse(content) as SyncState
}

/**
 * Save sync state to disk. Creates data/ directory if needed.
 * Uses sync operations for CLI simplicity and to avoid race conditions.
 */
export function saveState(state: SyncState): void {
  const dir = dirname(STATE_PATH)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

/**
 * Update chat state with new last message ID.
 * Mutates the state object in place - caller is responsible for saving.
 *
 * @param state - Sync state object to update
 * @param chatId - Chat ID to update
 * @param lastMessageId - Last exported message ID
 * @param chatName - Chat name for display (cached)
 */
export function updateChatState(
  state: SyncState,
  chatId: number,
  lastMessageId: number,
  chatName: string
): void {
  state.chats[chatId] = {
    lastMessageId,
    lastSyncedAt: new Date().toISOString(),
    chatName
  }
}

/**
 * Update folder state with current chat membership.
 * Mutates the state object in place - caller is responsible for saving.
 *
 * @param state - Sync state object to update
 * @param folderId - Folder ID to update
 * @param chatIds - Current chat IDs in folder
 */
export function updateFolderState(
  state: SyncState,
  folderId: number,
  chatIds: number[]
): void {
  state.folders[folderId] = {
    chatIds,
    lastSyncedAt: new Date().toISOString()
  }
}
