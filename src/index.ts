import 'dotenv/config'
import { Command } from 'commander'
import { password, isCancel, intro } from '@clack/prompts'
import chalk from 'chalk'
import { createClient } from './client.js'
import { ensureAuthenticated } from './auth.js'

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
  .command('export')
  .description('Export chats from tracked folders')
  .action(async () => {
    console.log(chalk.yellow('Export not yet implemented (coming in Phase 3)'))
  })

program.parse()
