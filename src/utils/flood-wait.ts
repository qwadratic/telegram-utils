import { tl } from '@mtcute/node'
import chalk from 'chalk'

/**
 * Execute a function with automatic FLOOD_WAIT error handling.
 * Waits the required duration + 1 second buffer, then retries.
 *
 * @param fn - The async function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns The result of the function
 * @throws Error if max retries exceeded or non-FLOOD_WAIT error
 */
export async function withFloodWaitHandling<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (tl.RpcError.is(e, 'FLOOD_WAIT_%d')) {
        const waitSeconds = e.seconds
        console.log(chalk.yellow(`Flood wait: waiting ${waitSeconds} seconds...`))
        await sleep((waitSeconds + 1) * 1000)
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded due to flood wait')
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
