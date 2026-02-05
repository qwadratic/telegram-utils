import type { TelegramClient } from '@mtcute/node'

/**
 * Get display name for a chat.
 *
 * @param tg - Telegram client
 * @param chatId - Chat ID to look up
 * @returns Chat name or fallback to string ID
 */
export async function getChatName(tg: TelegramClient, chatId: number): Promise<string> {
  try {
    const peer = await tg.getPeer(chatId)
    return peer.displayName || String(chatId)
  } catch {
    return String(chatId)
  }
}
