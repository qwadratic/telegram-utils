import type { SyncState } from '../sync/state.js'
import type { FolderRef } from '../messages/frontmatter.js'

/**
 * Every tracked folder that currently holds this chat, lowest id first.
 *
 * Derived from the folder membership snapshot already in state rather than
 * stored per chat, so it cannot drift. Ordered so the rendered `folder_ids`
 * is stable run to run - an unstable field would rewrite every file and
 * re-ship the whole archive on every pass.
 */
export function foldersForChat(state: SyncState, chatId: number): FolderRef[] {
  return Object.entries(state.folders)
    .filter(([, folder]) => folder.chatIds.includes(chatId))
    .map(([rawId, folder]) => ({ id: Number(rawId), title: folder.title ?? `folder ${rawId}` }))
    .sort((a, b) => a.id - b.id)
}

export interface FolderStatus {
  id: number
  title: string
  chatCount: number
  /** Chats in this folder that have been exported at least once. */
  syncedChatCount: number
  /** Newest per-chat sync time in this folder, or null if nothing exported yet. */
  lastUpdated: string | null
  /** Newest message id seen across the folder's chats; 0 when nothing exported. */
  lastMessageId: number
}

/**
 * Summarise every tracked folder, newest export first.
 *
 * Derived rather than stored: per-chat watermarks are already the source of
 * truth, so a folder's "last updated" cannot drift out of sync with them.
 * Pure and offline - listing folders needs no Telegram connection.
 */
export function folderStatuses(state: SyncState): FolderStatus[] {
  const statuses = Object.entries(state.folders).map(([rawId, folder]) => {
    const id = Number(rawId)
    let lastUpdated: string | null = null
    let lastMessageId = 0
    let syncedChatCount = 0

    for (const chatId of folder.chatIds) {
      const chat = state.chats[chatId]
      if (!chat) continue
      syncedChatCount++
      // String compare is correct here: ISO-8601 UTC sorts lexicographically.
      if (!lastUpdated || chat.lastSyncedAt > lastUpdated) lastUpdated = chat.lastSyncedAt
      if (chat.lastMessageId > lastMessageId) lastMessageId = chat.lastMessageId
    }

    return {
      id,
      title: folder.title ?? `folder ${id}`,
      chatCount: folder.chatIds.length,
      syncedChatCount,
      lastUpdated,
      lastMessageId
    }
  })

  return statuses.sort((a, b) => {
    // Never-exported folders sort last; they are the ones needing attention,
    // but they have no timestamp to rank by.
    if (a.lastUpdated === b.lastUpdated) return a.title.localeCompare(b.title)
    if (!a.lastUpdated) return 1
    if (!b.lastUpdated) return -1
    return b.lastUpdated.localeCompare(a.lastUpdated)
  })
}

/** "3m ago", "5h ago", "2d ago" - relative to `now`, injected so this stays pure. */
export function relativeTime(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const deltaMs = now - Date.parse(iso)
  if (!Number.isFinite(deltaMs)) return 'unknown'
  if (deltaMs < 60_000) return 'just now'

  const units: [number, string][] = [
    [86_400_000, 'd'],
    [3_600_000, 'h'],
    [60_000, 'm']
  ]
  for (const [ms, suffix] of units) {
    if (deltaMs >= ms) return `${Math.floor(deltaMs / ms)}${suffix} ago`
  }
  return 'just now'
}
