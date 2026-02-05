import { confirm, isCancel, password } from '@clack/prompts'
import chalk from 'chalk'
import type { TelegramClient } from '@mtcute/node'
import { createClient } from '../../client.js'
import { ensureAuthenticated } from '../../auth.js'
import { refreshTrackedChats, syncFolderConfig } from '../../folders/index.js'
import { loadConfig } from '../../config/index.js'
import { logWarning } from '../log.js'

/**
 * Format duration in milliseconds to human-readable string.
 * Returns "Xm Ys" or just "Ys" if under a minute.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export async function withAuthenticatedClient<T>(
  message: string,
  fn: (tg: TelegramClient) => Promise<T>,
  options: { silentCancel?: boolean } = {}
): Promise<T> {
  const tg = await createClientWithPasswordRetry(message, options)
  try {
    await ensureAuthenticated(tg)
    return await fn(tg)
  } finally {
    await tg.destroy()
  }
}

export async function resolveExportConfig(tg: TelegramClient) {
  let config = loadConfig()
  if (config.trackedFolderIds.length === 0) {
    const shouldSelect = await confirm({
      message: 'No folders selected. Run setup to choose folders for export?'
    })
    if (isCancel(shouldSelect) || !shouldSelect) {
      logWarning('No folders selected. Export cancelled.')
      return null
    }
    await syncFolderConfig(tg, true)
    config = loadConfig()
  }

  const refreshed = await refreshTrackedChats(tg, config)
  const totalChats = refreshed.config.trackedChatIds.length
  if (totalChats === 0) {
    logWarning('No chats found in selected folders. Run "symbiotic-chats setup --select" to update selection.')
    return null
  }

  return refreshed.config
}

export async function createClientWithPasswordRetry(
  message: string,
  options: { silentCancel?: boolean } = {}
): Promise<TelegramClient> {
  for (;;) {
    const sessionPass = await password({ message })
    if (isCancel(sessionPass)) {
      if (!options.silentCancel) {
        console.log(chalk.yellow('Cancelled'))
      }
      process.exit(0)
    }

    const tg = createClient(sessionPass as string)
    try {
      await tg.connect()
      return tg
    } catch (error) {
      await tg.destroy().catch(() => undefined)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (/invalid session password/i.test(errorMessage)) {
        console.error(chalk.red('Invalid session password. Please try again.'))
        continue
      }
      throw error
    }
  }
}
