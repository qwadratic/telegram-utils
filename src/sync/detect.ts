import { select, multiselect, isCancel } from '@clack/prompts'
import type { SyncState } from './state.js'

/**
 * Result of detecting changes between sync state and current folder contents.
 */
export interface ChangeDetection {
  newChats: Array<{ id: number; folderId: number; name?: string }>
  removedChats: Array<{ id: number; folderId: number; name?: string }>
  newFolders: number[]
}

/**
 * User choice for handling new chats detected in folders.
 */
export interface NewChatChoice {
  action: 'add-all' | 'select' | 'skip'
  selectedIds: number[]
}

/**
 * User choice for handling new folders detected in Telegram.
 */
export interface NewFolderChoice {
  action: 'track-all' | 'select' | 'skip'
  selectedIds: number[]
}

/**
 * User choice for handling chats removed from folders.
 */
export interface RemovedChatChoice {
  action: 'keep-all' | 'select' | 'remove-all'
  keepIds: number[]
}

/**
 * Detect changes between sync state and current folder contents.
 *
 * Compares:
 * - Chats added to folders since last sync
 * - Chats removed from folders since last sync
 * - Entirely new folders not in state
 *
 * @param state - Current sync state
 * @param currentFolderChats - Map of folder ID to current chat IDs
 * @param trackedFolderIds - Array of folder IDs being tracked
 * @returns Detection result with new/removed chats and new folders
 */
export function detectChanges(
  state: SyncState,
  currentFolderChats: Record<number, number[]>,
  trackedFolderIds: number[]
): ChangeDetection {
  const newChats: Array<{ id: number; folderId: number; name?: string }> = []
  const removedChats: Array<{ id: number; folderId: number; name?: string }> = []
  const newFolders: number[] = []

  for (const folderId of trackedFolderIds) {
    const currentChats = currentFolderChats[folderId] || []
    const folderState = state.folders[folderId]

    // Check if this is a new folder (not in state)
    if (!folderState) {
      newFolders.push(folderId)
      // All chats in this folder are new
      for (const chatId of currentChats) {
        const chatState = state.chats[chatId]
        newChats.push({
          id: chatId,
          folderId,
          name: chatState?.chatName
        })
      }
      continue
    }

    const previousChats = folderState.chatIds || []
    const previousSet = new Set(previousChats)
    const currentSet = new Set(currentChats)

    // Find new chats (in current but not in previous)
    for (const chatId of currentChats) {
      if (!previousSet.has(chatId)) {
        const chatState = state.chats[chatId]
        newChats.push({
          id: chatId,
          folderId,
          name: chatState?.chatName
        })
      }
    }

    // Find removed chats (in previous but not in current)
    for (const chatId of previousChats) {
      if (!currentSet.has(chatId)) {
        const chatState = state.chats[chatId]
        removedChats.push({
          id: chatId,
          folderId,
          name: chatState?.chatName
        })
      }
    }
  }

  return { newChats, removedChats, newFolders }
}

/**
 * Interactive prompt for handling new chats detected in folders.
 *
 * @param newChats - Array of new chats with id and name
 * @returns User's choice of action and selected chat IDs
 */
export async function promptNewChats(
  newChats: Array<{ id: number; name: string }>
): Promise<NewChatChoice> {
  const count = newChats.length
  const chatLabel = count === 1 ? 'chat' : 'chats'

  const action = await select({
    message: `Found ${count} new ${chatLabel}. What would you like to do?`,
    options: [
      { value: 'add-all', label: 'Add all new chats', hint: 'recommended' },
      { value: 'select', label: 'Select which to add' },
      { value: 'skip', label: 'Skip for now' }
    ]
  })

  if (isCancel(action)) {
    process.exit(0)
  }

  if (action === 'add-all') {
    return {
      action: 'add-all',
      selectedIds: newChats.map(c => c.id)
    }
  }

  if (action === 'select') {
    const selected = await multiselect({
      message: 'Select chats to add:',
      options: newChats.map(c => ({
        value: c.id,
        label: c.name || `Chat ${c.id}`
      })),
      required: false
    })

    if (isCancel(selected)) {
      process.exit(0)
    }

    return {
      action: 'select',
      selectedIds: selected as number[]
    }
  }

  // skip
  return {
    action: 'skip',
    selectedIds: []
  }
}

/**
 * Interactive prompt for handling new folders detected in Telegram.
 *
 * @param newFolders - Array of new folders with id and name
 * @returns User's choice of action and selected folder IDs
 */
export async function promptNewFolders(
  newFolders: Array<{ id: number; name: string }>
): Promise<NewFolderChoice> {
  const count = newFolders.length
  const folderLabel = count === 1 ? 'folder' : 'folders'

  const action = await select({
    message: `Found ${count} new ${folderLabel} in Telegram. Track these new folders?`,
    options: [
      { value: 'track-all', label: 'Track all new folders' },
      { value: 'select', label: 'Select which to track' },
      { value: 'skip', label: 'Skip for now' }
    ]
  })

  if (isCancel(action)) {
    process.exit(0)
  }

  if (action === 'track-all') {
    return {
      action: 'track-all',
      selectedIds: newFolders.map(f => f.id)
    }
  }

  if (action === 'select') {
    const selected = await multiselect({
      message: 'Select folders to track:',
      options: newFolders.map(f => ({
        value: f.id,
        label: f.name
      })),
      required: false
    })

    if (isCancel(selected)) {
      process.exit(0)
    }

    return {
      action: 'select',
      selectedIds: selected as number[]
    }
  }

  // skip
  return {
    action: 'skip',
    selectedIds: []
  }
}

/**
 * Interactive prompt for handling chats removed from folders.
 *
 * @param removedChats - Array of removed chats with id and name
 * @returns User's choice of action and IDs of chats to keep
 */
export async function promptRemovedChats(
  removedChats: Array<{ id: number; name: string }>
): Promise<RemovedChatChoice> {
  const count = removedChats.length
  const chatLabel = count === 1 ? 'chat' : 'chats'

  const action = await select({
    message: `${count} ${chatLabel} no longer in tracked folders. What would you like to do?`,
    options: [
      { value: 'keep-all', label: 'Keep tracking all' },
      { value: 'select', label: 'Select which to keep' },
      { value: 'remove-all', label: 'Stop tracking all' }
    ]
  })

  if (isCancel(action)) {
    process.exit(0)
  }

  if (action === 'keep-all') {
    return {
      action: 'keep-all',
      keepIds: removedChats.map(c => c.id)
    }
  }

  if (action === 'select') {
    const selected = await multiselect({
      message: 'Select chats to keep tracking:',
      options: removedChats.map(c => ({
        value: c.id,
        label: c.name || `Chat ${c.id}`
      })),
      required: false
    })

    if (isCancel(selected)) {
      process.exit(0)
    }

    return {
      action: 'select',
      keepIds: selected as number[]
    }
  }

  // remove-all
  return {
    action: 'remove-all',
    keepIds: []
  }
}
