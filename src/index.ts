import 'dotenv/config'
import { Command } from 'commander'

const program = new Command()
  .name('symbiotic-chats')
  .description('Export Telegram chat history to Markdown')
  .version('0.1.0')

program
  .command('auth')
  .description('Authenticate with Telegram')
  .action(() => {
    console.log('Auth flow will be implemented in Plan 02')
  })

program
  .command('export')
  .description('Export chats from tracked folders')
  .action(() => {
    console.log('Export not yet implemented (Phase 3)')
  })

program.parse()
