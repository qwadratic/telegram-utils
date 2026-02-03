import 'dotenv/config'
import { Command } from 'commander'
import { password, isCancel, intro } from '@clack/prompts'
import chalk from 'chalk'
import { createClient } from './client.js'
import { ensureAuthenticated } from './auth.js'
import { syncFolderConfig } from './folders/index.js'
import { loadConfig } from './config/index.js'
import { exportChats } from './messages/index.js'

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
  .command('folders')
  .description('List and select Telegram folders to track')
  .action(async () => {
    try {
      intro(chalk.cyan('Folder Configuration'))
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

        // Sync folder config (first run: select, subsequent: diff)
        await syncFolderConfig(tg)

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

        // Load config and check for tracked folders
        const config = loadConfig()
        const totalChats = Object.values(config.trackedFolders).flat().length

        if (totalChats === 0) {
          console.log(chalk.yellow('No folders tracked. Run "symbiotic-chats folders" first to select folders.'))
          return
        }

        // Run export
        const result = await exportChats(tg, config)

        // Display completion summary
        const duration = formatDuration(result.durationMs)
        if (result.chatsSkipped > 0) {
          console.log(chalk.green(`\nExported ${result.chatsExported} chats (${result.chatsSkipped} skipped), ${result.messagesExported} messages in ${duration}`))
        } else {
          console.log(chalk.green(`\nExported ${result.chatsExported} chats, ${result.messagesExported} messages in ${duration}`))
        }

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

program.parse()
