import { TelegramClient, tl } from '@mtcute/node'
import { getMarkedPeerId } from '@mtcute/core'

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
