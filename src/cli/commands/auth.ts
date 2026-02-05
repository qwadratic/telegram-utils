import { intro } from '@clack/prompts'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureAuthenticated } from '../../auth.js'
import { runCommand } from '../errors.js'
import { createClientWithPasswordRetry } from './shared.js'

export function registerAuthCommand(program: Command): void {
  program
    .command('auth')
    .description('Authenticate with Telegram')
    .action(async () => {
      await runCommand(async () => {
        // Prompt for session password (decrypts/encrypts session.db)
        intro(chalk.cyan('Session Password'))
        const tg = await createClientWithPasswordRetry(
          'Enter session password (encrypts your session file):'
        )

        try {
          const user = await ensureAuthenticated(tg)
          console.log(chalk.green(`\nLogged in as: ${user.firstName} ${user.lastName || ''} (@${user.username || 'no username'})`))
        } finally {
          await tg.destroy()
        }
      })
    })
}
