import type { TelegramClient, Message } from '@mtcute/node'

/**
 * Sleep for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Async generator that fetches messages from a chat with rate limiting.
 *
 * - Uses iterHistory with chunkSize of 100
 * - After every 100 messages, waits 1.5s + random 0-500ms jitter
 * - Calls onProgress callback (if provided) with current message count
 * - Messages are yielded newest-first (as returned by iterHistory)
 *
 * Note: The writer layer should handle reversal for chronological output.
 *
 * @param tg - Telegram client instance
 * @param chatId - Chat ID to fetch messages from
 * @param onProgress - Optional callback called every 100 messages with count
 */
export async function* fetchMessages(
  tg: TelegramClient,
  chatId: number,
  onProgress?: (count: number) => void
): AsyncGenerator<Message> {
  const chunkSize = 100
  let count = 0

  for await (const msg of tg.iterHistory(chatId, { chunkSize })) {
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
