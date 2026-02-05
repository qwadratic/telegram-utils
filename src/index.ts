import dotenv from 'dotenv'
dotenv.config({ override: true })

import { Command } from 'commander'
import { confirm, password, isCancel, intro, spinner } from '@clack/prompts'
import chalk from 'chalk'
import { existsSync } from 'node:fs'
import type { TelegramClient } from '@mtcute/node'
import { createClient } from './client.js'
import { ensureAuthenticated } from './auth.js'
import { refreshTrackedChats, syncFolderConfig } from './folders/index.js'
import { loadConfig, CONFIG_PATH } from './config/index.js'
import { syncChats } from './sync/index.js'
import { importContactsByPhone } from './contacts/import.js'
import { exportRecencyChats } from './messages/recency.js'

/**
 * Format duration in milliseconds to human-readable string.
 * Returns "Xm Ys" or just "Ys" if under a minute.
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function parseCutoffDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function normalizePhoneInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const hasPlus = trimmed.startsWith('+')
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (!digitsOnly) return ''
  return hasPlus ? `+${digitsOnly}` : digitsOnly
}

async function resolveExportConfig(tg: TelegramClient) {
  let config = loadConfig()
  if (config.trackedFolderIds.length === 0) {
    const shouldSelect = await confirm({
      message: 'No folders selected. Run setup to choose folders for export?'
    })
    if (isCancel(shouldSelect) || !shouldSelect) {
      console.log(chalk.yellow('No folders selected. Export cancelled.'))
      return null
    }
    await syncFolderConfig(tg, true)
    config = loadConfig()
  }

  const refreshed = await refreshTrackedChats(tg, config)
  const totalChats = refreshed.config.trackedChatIds.length
  if (totalChats === 0) {
    console.log(chalk.yellow('No chats found in selected folders. Run "symbiotic-chats setup --select" to update selection.'))
    return null
  }

  return refreshed.config
}

async function createClientWithPasswordRetry(
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

const program = new Command()
  .name('symbiotic-chats')
  .description('Export Telegram chat history to Markdown')
  .version('0.1.0')

program
  .command('auth')
  .description('Authenticate with Telegram')
  .action(async () => {
    try {
      // Prompt for session password (decrypts/encrypts session.db)
      intro(chalk.cyan('Session Password'))
      const tg = await createClientWithPasswordRetry(
        'Enter session password (encrypts your session file):'
      )

      const user = await ensureAuthenticated(tg)
      console.log(chalk.green(`\nLogged in as: ${user.firstName} ${user.lastName || ''} (@${user.username || 'no username'})`))

      await tg.destroy()
    } catch (e) {
      if (e instanceof Error) {
        console.error(chalk.red(`Error: ${e.message}`))
      } else {
        console.error(chalk.red('An unexpected error occurred'))
      }
      process.exit(1)
    }
  })

program
  .command('setup')
  .description('Select Telegram folders to export')
  .option('--select', 'Force folder re-selection')
  .action(async (options) => {
    try {
      intro(chalk.cyan('Export Setup'))
      const tg = await createClientWithPasswordRetry('Enter session password:')

      try {
        // Ensure user is authenticated before accessing folders
        await ensureAuthenticated(tg)

        // Sync setup config (first run: select, subsequent: refresh)
        await syncFolderConfig(tg, options.select)

      } finally {
        await tg.destroy()
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(chalk.red(`Error: ${e.message}`))
      } else {
        console.error(chalk.red('An unexpected error occurred'))
      }
      process.exit(1)
    }
  })

const exportCommand = program
  .command('export')
  .description('Export chats from tracked folders')
  .action(() => {
    exportCommand.help()
  })

exportCommand
  .command('sync')
  .description('Sync chats into per-chat archive files')
  .action(async () => {
    try {
      intro(chalk.cyan('Export Chats'))
      const tg = await createClientWithPasswordRetry('Enter session password:', {
        silentCancel: true,
      })

      try {
        // Ensure user is authenticated
        await ensureAuthenticated(tg)

        const config = await resolveExportConfig(tg)
        if (!config) {
          return
        }

        // Run incremental sync
        const result = await syncChats(tg, config)

        // Display sync summary
        const duration = formatDuration(result.durationMs)
        const parts = [
          `${result.chatsProcessed} chats synced`,
          `${result.messagesAppended} messages`,
          `${result.filesUpdated} files updated`,
        ]
        if (result.newChatsAdded > 0) {
          parts.push(`${result.newChatsAdded} new chats added`)
        }
        if (result.newFoldersAdded > 0) {
          parts.push(`${result.newFoldersAdded} new folders tracked`)
        }
        if (result.chatsSkipped > 0) {
          parts.push(`${result.chatsSkipped} empty chats skipped`)
        }
        console.log(chalk.green(`\n${parts.join(', ')} in ${duration}`))

      } finally {
        await tg.destroy()
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(chalk.red(`Error: ${e.message}`))
      } else {
        console.error(chalk.red('An unexpected error occurred'))
      }
      process.exit(1)
    }
  })

exportCommand
  .command('recent')
  .description('Export recent messages across all chats to data/archive/recent.md')
  .requiredOption('--cutoff <YYYY-MM-DD>', 'Cutoff date for recent messages (inclusive)')
  .action(async (options: { cutoff: string }) => {
    try {
      intro(chalk.cyan('Export Recent Messages'))
      const cutoffDate = parseCutoffDate(options.cutoff)
      if (!cutoffDate) {
        console.error(chalk.red('Error: --cutoff must be in YYYY-MM-DD format'))
        process.exit(1)
      }
      const tg = await createClientWithPasswordRetry('Enter session password:', {
        silentCancel: true,
      })

      try {
        await ensureAuthenticated(tg)
        const config = await resolveExportConfig(tg)
        if (!config) return

        const result = await exportRecencyChats(
          tg,
          config,
          cutoffDate,
          'recent',
          options.cutoff
        )
        const duration = formatDuration(result.durationMs)
        console.log(chalk.green(`\n${result.messagesExported} recent messages exported to ${result.outputPath} in ${duration}`))
      } finally {
        await tg.destroy()
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(chalk.red(`Error: ${e.message}`))
      } else {
        console.error(chalk.red('An unexpected error occurred'))
      }
      process.exit(1)
    }
  })

exportCommand
  .command('historical')
  .description('Export historical messages across all chats to data/archive/historical.md')
  .requiredOption('--cutoff <YYYY-MM-DD>', 'Cutoff date for historical messages (exclusive)')
  .action(async (options: { cutoff: string }) => {
    try {
      intro(chalk.cyan('Export Historical Messages'))
      const cutoffDate = parseCutoffDate(options.cutoff)
      if (!cutoffDate) {
        console.error(chalk.red('Error: --cutoff must be in YYYY-MM-DD format'))
        process.exit(1)
      }
      const tg = await createClientWithPasswordRetry('Enter session password:', {
        silentCancel: true,
      })

      try {
        await ensureAuthenticated(tg)
        const config = await resolveExportConfig(tg)
        if (!config) return

        const result = await exportRecencyChats(
          tg,
          config,
          cutoffDate,
          'historical',
          options.cutoff
        )
        const duration = formatDuration(result.durationMs)
        console.log(chalk.green(`\n${result.messagesExported} historical messages exported to ${result.outputPath} in ${duration}`))
      } finally {
        await tg.destroy()
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(chalk.red(`Error: ${e.message}`))
      } else {
        console.error(chalk.red('An unexpected error occurred'))
      }
      process.exit(1)
    }
  })

program
  .command('check-phones')
  .description('Check phone numbers via contacts import, output CSV to stdout')
  .argument('<phones>', 'Comma-separated phone numbers (e.g., +1234567890,+0987654321)')
  .option('--batch <number>', 'Contacts per import batch (default: 1)', '1')
  .option('--delay <number>', 'Delay between batches in ms (default: 1500)', '1500')
  .option('--keep', 'Do not remove imported contacts after checking')
  .option('--debug', 'Print import request/response details to stderr')
  .action(async (phonesArg: string, options: { batch: string; delay: string; keep?: boolean; debug?: boolean }) => {
    try {
      // Parse comma-separated phones
      const rawParts = phonesArg.split(',')
      const phones = rawParts.map(normalizePhoneInput).filter(Boolean)
      const skippedCount = rawParts.length - phones.length

      if (phones.length === 0) {
        console.error('Error: No phone numbers provided')
        process.exit(1)
      }
      if (skippedCount > 0) {
        console.error(`Skipped ${skippedCount} empty entries after parsing`)
      }

      // Session password via prompt (stderr so it doesn't pollute CSV output)
      const tg = await createClientWithPasswordRetry('Enter session password:')

      try {
        await ensureAuthenticated(tg)

        const parsedBatchSize = Number.parseInt(options.batch, 10)
        const parsedDelayMs = Number.parseInt(options.delay, 10)
        if (!Number.isFinite(parsedBatchSize) || parsedBatchSize < 1) {
          console.error('Error: --batch must be a positive integer')
          process.exit(1)
        }
        if (!Number.isFinite(parsedDelayMs) || parsedDelayMs < 0) {
          console.error('Error: --delay must be zero or a positive integer')
          process.exit(1)
        }

        const s = spinner()
        s.start(`Checked 0 of ${phones.length} phones...`)

        const results = await importContactsByPhone(tg, phones, {
          batchSize: parsedBatchSize,
          delayMs: parsedDelayMs,
          deleteAfter: !options.keep,
          debug: options.debug,
          onProgress: (checked, total) => {
            s.message(`Checked ${checked} of ${total} phones...`)
          }
        })

        s.stop(`Checked ${phones.length} phones`)
        const validResults = results.filter(r => r.userId != null)

        // Output CSV to stdout (header + data)
        if (validResults.length > 0) {
          console.log('user_id,phone_number,username')
          for (const r of validResults) {
            console.log(`${r.userId},${r.phone},${r.username ?? ''}`)
          }
        }
        console.error(`checked=${results.length}, valid=${validResults.length}`)

      } finally {
        await tg.destroy()
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(`Error: ${e.message}`)
      } else {
        console.error('An unexpected error occurred')
      }
      process.exit(1)
    }
  })

program.parse()
