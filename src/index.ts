import 'dotenv/config'
import { Command } from 'commander'
import { confirm, password, isCancel, intro } from '@clack/prompts'
import chalk from 'chalk'
import { existsSync } from 'node:fs'
import { createClient } from './client.js'
import { ensureAuthenticated } from './auth.js'
import { refreshTrackedChats, syncFolderConfig } from './folders/index.js'
import { loadConfig, CONFIG_PATH } from './config/index.js'
import { syncChats } from './sync/index.js'
import { importContactsByPhone } from './contacts/import.js'

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
      const sessionPass = await password({
        message: 'Enter session password (encrypts your session file):'
      })
      if (isCancel(sessionPass)) {
        console.log(chalk.yellow('Cancelled'))
        process.exit(0)
      }

      const tg = createClient(sessionPass)
      await tg.connect()

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
      const sessionPass = await password({
        message: 'Enter session password:'
      })
      if (isCancel(sessionPass)) {
        console.log(chalk.yellow('Cancelled'))
        process.exit(0)
      }

      const tg = createClient(sessionPass as string)

      try {
        await tg.connect()

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

program
  .command('export')
  .description('Export chats from tracked folders')
  .action(async () => {
    try {
      intro(chalk.cyan('Export Chats'))
      const sessionPass = await password({
        message: 'Enter session password:'
      })
      if (isCancel(sessionPass)) {
        console.log(chalk.yellow('Cancelled'))
        process.exit(0)
      }

      const tg = createClient(sessionPass as string)

      try {
        await tg.connect()

        // Ensure user is authenticated
        await ensureAuthenticated(tg)

        // Load config and ensure folders are selected
        let config = loadConfig()
        if (config.trackedFolderIds.length === 0) {
          const shouldSelect = await confirm({
            message: 'No folders selected. Run setup to choose folders for export?'
          })
          if (isCancel(shouldSelect) || !shouldSelect) {
            console.log(chalk.yellow('No folders selected. Export cancelled.'))
            return
          }
          await syncFolderConfig(tg, true)
          config = loadConfig()
        }

        const refreshed = await refreshTrackedChats(tg, config)
        const totalChats = refreshed.config.trackedChatIds.length

        if (totalChats === 0) {
          console.log(chalk.yellow('No chats found in selected folders. Run "symbiotic-chats setup --select" to update selection.'))
          return
        }

        // Run incremental sync
        const result = await syncChats(tg, refreshed.config)

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

program
  .command('import-contacts')
  .description('Import contacts by phone numbers, output CSV to stdout')
  .argument('<phones>', 'Comma-separated phone numbers (e.g., +1234567890,+0987654321)')
  .action(async (phonesArg: string) => {
    try {
      // Parse comma-separated phones
      const phones = phonesArg.split(',').map(p => p.trim()).filter(Boolean)

      if (phones.length === 0) {
        console.error('Error: No phone numbers provided')
        process.exit(1)
      }

      // Session password via prompt (stderr so it doesn't pollute CSV output)
      const sessionPass = await password({
        message: 'Enter session password:'
      })
      if (isCancel(sessionPass)) {
        process.exit(0)
      }

      const tg = createClient(sessionPass as string)

      try {
        await tg.connect()
        await ensureAuthenticated(tg)

        const results = await importContactsByPhone(tg, phones)

        // Output CSV to stdout (header + data)
        console.log('user_id,phone_number')
        for (const r of results) {
          console.log(`${r.userId ?? ''},${r.phone}`)
        }

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
