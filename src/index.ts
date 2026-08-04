import dotenv from 'dotenv'
// quiet: the startup banner would otherwise land on stdout and break
// `... --json | jq` for anything scripting this CLI.
dotenv.config({ override: true, quiet: true })

import { Command } from 'commander'
import { registerAuthCommand } from './cli/commands/auth.js'
import { registerSessionCommand } from './cli/commands/session.js'
import { registerFoldersCommand } from './cli/commands/folders.js'
import { registerSetupCommand } from './cli/commands/setup.js'
import { registerExportSyncCommand } from './cli/commands/export-sync.js'
import { registerExportRecentCommand } from './cli/commands/export-recent.js'
import { registerExportHistoricalCommand } from './cli/commands/export-historical.js'
import { registerCheckPhonesCommand } from './cli/commands/check-phones.js'

const program = new Command()
  .name('symbiotic-chats')
  .description('Export Telegram chat history to Markdown')
  .version('0.1.0')

registerAuthCommand(program)
registerSessionCommand(program)
registerSetupCommand(program)
registerFoldersCommand(program)

const exportCommand = program
  .command('export')
  .description('Export chats from tracked folders')
  .action(() => {
    exportCommand.help()
  })

registerExportSyncCommand(exportCommand)
registerExportRecentCommand(exportCommand)
registerExportHistoricalCommand(exportCommand)

registerCheckPhonesCommand(program)

program.parse()
