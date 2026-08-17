import type { TelegramClient, Message } from '@mtcute/node'
import { sleep } from '../utils/sleep.js'

/**
 * Options for fetching messages.
 */
export interface FetchMessagesOptions {
  /** Only fetch messages with ID > minId (exclusive). For incremental sync. */
  minId?: number
  /** Called every 100 messages with current count. */
  onProgress?: (count: number) => void
}

/**
 * Async generator that fetches messages from a chat with rate limiting.
 *
 * - Uses iterHistory with chunkSize of 100
 * - After every 100 messages, waits 1.5s + random 0-500ms jitter
 * - Calls onProgress callback (if provided) with current message count
 * - Messages are yielded newest-first (as returned by iterHistory)
 * - When minId is provided, only messages newer than minId are fetched
 *
 * Note: The writer layer should handle reversal for chronological output.
 * Note: mtcute's minId is EXCLUSIVE - messages with ID > minId are returned.
 *
 * @param tg - Telegram client instance
 * @param chatId - Chat ID to fetch messages from
 * @param options - Optional fetch options (minId, onProgress)
 */
export async function* fetchMessages(
  tg: TelegramClient,
  chatId: number,
  options?: FetchMessagesOptions
): AsyncGenerator<Message> {
  const chunkSize = 100
  const onProgress = options?.onProgress
  let count = 0

  for await (const msg of tg.iterHistory(chatId, {
    chunkSize,
    minId: options?.minId
  })) {
    yield msg
    count++

    // Rate limit every chunk
    if (count % chunkSize === 0) {
      if (onProgress) {
        onProgress(count)
      }
      // 1.5s + random 0-500ms jitter
      const delay = 1500 + Math.random() * 500
      await sleep(delay)
    }
  }

  // Final progress update for remaining messages
  if (onProgress && count % chunkSize !== 0) {
    onProgress(count)
  }
}
